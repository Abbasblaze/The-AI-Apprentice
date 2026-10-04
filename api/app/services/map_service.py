from __future__ import annotations

import re
import uuid
from typing import Literal, Optional

from openai import AsyncOpenAI
from pydantic import BaseModel

from app.config import config
from app.schemas import (
    DebriefState,
    Gap,
    GapKind,
    GapPriority,
    Guardrail,
    GuardrailKind,
    ScreenMoment,
    SessionRecord,
    SnapshotIndex,
    Step,
    StepReason,
    TranscriptEntry,
    TranscriptPhase,
    WorkMap,
)

_client = AsyncOpenAI(api_key=config.openai_api_key)

_STOPWORDS = frozenset({
    "a", "an", "the", "is", "are", "was", "were", "you", "your",
    "did", "do", "does", "what", "why", "how", "when", "where",
    "that", "this", "it", "to", "of", "in", "on", "at", "for",
    "and", "or", "but", "so", "if", "then", "made", "about",
})


def _normalize(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^\w\s']", ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def _find_quote(quote: str, entries: list[TranscriptEntry]) -> Optional[float]:
    norm_q = _normalize(quote)
    if not norm_q:
        return None
    for entry in entries:
        if norm_q in _normalize(entry.message):
            return entry.t
    return None


def _nearest_snapshot(t: float, snapshots: list[SnapshotIndex]) -> Optional[float]:
    if not snapshots:
        return None
    return min(snapshots, key=lambda s: abs(s.t - t)).t


def _snapshot_exists(snapshot_t: float, snapshots: list[SnapshotIndex]) -> bool:
    return any(abs(s.t - snapshot_t) < 0.5 for s in snapshots)


def _significant_words(text: str) -> frozenset[str]:
    tokens = set(re.findall(r"\b\w+\b", text.lower()))
    return frozenset(tokens - _STOPWORDS)


def _overlaps_answered(question: str, decisions: list) -> bool:
    q_words = _significant_words(question)
    if not q_words:
        return False
    for d in decisions:
        if not d.answered:
            continue
        d_words = _significant_words(d.question)
        if not d_words:
            continue
        overlap = len(q_words & d_words) / min(len(q_words), len(d_words))
        if overlap > 0.5:
            return True
    return False


_MIN_GAPS_ANSWERED = 3
_HARD_STOP_GAPS = 8
_MIN_STEP_CONFIDENCE = 0.8


def _should_move_to_teachback(state: DebriefState) -> tuple[bool, str]:
    if state.gaps_answered >= _HARD_STOP_GAPS:
        return True, "hard stop: 8 questions reached"
    open_high = [g for g in state.gaps if not g.closed and g.priority == GapPriority.high]
    if open_high:
        return False, ""
    if state.gaps_answered < _MIN_GAPS_ANSWERED:
        return False, ""
    map_ = state.map
    if map_ and all(s.confidence >= _MIN_STEP_CONFIDENCE for s in map_.steps):
        return True, "all steps clear"
    return False, ""


class _DraftReason(BaseModel):
    text: str
    quote: Optional[str] = None


class _DraftGuardrail(BaseModel):
    kind: GuardrailKind
    rule: str
    quote: str
    who_to_ask: Optional[str] = None
    applies_to: Optional[str] = None


class _DraftStep(BaseModel):
    order: int
    title: str
    event_t: float
    screen_subject: str
    decision: str
    reason: _DraftReason
    is_judgment_call: bool
    guardrails: list[_DraftGuardrail] = []
    confidence: float


class _DraftGap(BaseModel):
    step_order: Optional[int] = None
    kind: GapKind
    question: str
    priority: GapPriority


class _DraftMapOutput(BaseModel):
    process_name: str
    summary: str
    steps: list[_DraftStep]
    gaps: list[_DraftGap]


class _ApplyAnswerOutput(BaseModel):
    step_id: Optional[str] = None
    reason_update: Optional[str] = None
    quote: Optional[str] = None
    new_confidence: Optional[float] = None
    new_guardrail: Optional[_DraftGuardrail] = None
    follow_up_gap: Optional[_DraftGap] = None


class _ReplyOutput(BaseModel):
    classification: Literal["confirmed", "corrected", "unclear"]
    correction: Optional[str] = None
    correction_quote: Optional[str] = None
    partial_teachback: Optional[str] = None


def _build_events_context(record: SessionRecord) -> str:
    all_events = sorted(record.events + record.erp_events, key=lambda e: e.t)
    if not all_events:
        return "No events."
    return "\n".join(
        f"[{e.t:.1f}s] [{e.id}] {e.kind.value}: {e.summary}"
        + (f" | field={e.field}" if e.field else "")
        + (f" | {e.from_value} -> {e.to_value}" if e.from_value or e.to_value else "")
        + (f" [ERP]" if e.source.value == "erp" else "")
        for e in all_events
    )


def _build_transcript_context(entries: list[TranscriptEntry]) -> str:
    if not entries:
        return "No transcript."
    return "\n".join(f"[{e.t:.1f}s] {e.role.value}: {e.message}" for e in entries)


def _build_snapshots_context(snapshots: list[SnapshotIndex]) -> str:
    if not snapshots:
        return "No snapshots."
    return ", ".join(f"{s.t:.1f}s" for s in snapshots)


def _build_decisions_context(record: SessionRecord) -> str:
    answered = [d for d in record.decisions if d.should_ask and d.answered]
    if not answered:
        return "No answered questions."
    return "\n".join(
        f"Q: {d.question}\nA: {d.answer_text}" for d in answered
    )


def _validate_draft_step(
    draft: _DraftStep,
    snapshots: list[SnapshotIndex],
    interview_entries: list[TranscriptEntry],
) -> tuple[Step, list[Gap]]:
    extra_gaps: list[Gap] = []
    snapshot_t = _nearest_snapshot(draft.event_t, snapshots)
    if snapshot_t is None:
        snapshot_t = draft.event_t

    quote_t: Optional[float] = None
    unconfirmed = False
    quote = draft.reason.quote

    if quote:
        quote_t = _find_quote(quote, interview_entries)
        if quote_t is None:
            quote = None
            unconfirmed = True

    confidence = draft.confidence
    if unconfirmed or quote is None:
        confidence = min(confidence, 0.4)
        unconfirmed = True

    validated_guardrails: list[Guardrail] = []
    for g in draft.guardrails:
        g_quote_t = _find_quote(g.quote, interview_entries)
        if g_quote_t is None:
            extra_gaps.append(
                Gap(
                    id=str(uuid.uuid4()),
                    kind=GapKind.unclear_guardrail,
                    question=f"The rule '{g.rule}' could not be verified from the transcript. Can you confirm this rule?",
                    priority=GapPriority.high,
                )
            )
        else:
            validated_guardrails.append(
                Guardrail(
                    id=str(uuid.uuid4()),
                    kind=g.kind,
                    rule=g.rule,
                    quote=g.quote,
                    quote_t=g_quote_t,
                    who_to_ask=g.who_to_ask,
                    applies_to=g.applies_to,
                )
            )

    step = Step(
        id=str(uuid.uuid4()),
        order=draft.order,
        title=draft.title,
        screen_moment=ScreenMoment(
            t=draft.event_t,
            snapshot_t=snapshot_t,
            subject=draft.screen_subject,
        ),
        decision=draft.decision,
        reason=StepReason(
            text=draft.reason.text,
            quote=quote,
            quote_t=quote_t,
            unconfirmed=unconfirmed,
        ),
        is_judgment_call=draft.is_judgment_call,
        guardrails=validated_guardrails,
        confidence=confidence,
    )
    return step, extra_gaps


def _validate_draft_gap(
    draft: _DraftGap,
    step_map: dict[int, str],
    decisions: list,
) -> Optional[Gap]:
    if _overlaps_answered(draft.question, decisions):
        return None
    step_id = step_map.get(draft.step_order) if draft.step_order is not None else None
    return Gap(
        id=str(uuid.uuid4()),
        step_id=step_id,
        kind=draft.kind,
        question=draft.question,
        priority=draft.priority,
    )


_DRAFT_SYSTEM = (
    "You are a knowledge-capture assistant. "
    "You are given events from an expert's screen, a transcript of the interview, "
    "and the answers the expert gave to questions. "
    "Your job: extract a structured WorkMap of the expert's process. "
    "Group the events into 5-9 meaningful steps at a new-hire level. "
    "For each step: choose a representative event_t from the events list, "
    "write a decision the expert made, and quote the expert's exact words from the transcript as the reason. "
    "Mark steps as judgment calls when the expert used personal judgment not covered by a rule. "
    "Extract guardrails: limits, exceptions, holds, and stop-and-ask moments. "
    "Each guardrail MUST include a verbatim quote from the transcript. "
    "Generate gaps for: missing reasons, unclear guardrail scope, authority/approval requirements, "
    "unseen edge cases, and never-do items. "
    "Never invent reasons or rules — only use what the expert actually said."
)

_EXTRA_GAPS_SYSTEM = (
    "You are a knowledge-capture assistant reviewing a work process map. "
    "Generate exactly 3 new gap questions covering: "
    "1. Scope — when does this process NOT apply? "
    "2. Authority — who must approve exceptions? "
    "3. Never-do — what action would be catastrophic and must never be done? "
    "Use priority=high for all three."
)


async def draft_map(
    session_record: SessionRecord,
    client: AsyncOpenAI,
) -> tuple[WorkMap, list[Gap]]:
    interview_entries = [
        e for e in session_record.transcript
        if e.phase == TranscriptPhase.interview or not hasattr(e, 'phase')
    ]

    user_text = (
        f"Available snapshot times: {_build_snapshots_context(session_record.snapshots)}\n\n"
        f"Events (chronological):\n{_build_events_context(session_record)}\n\n"
        f"Interview transcript:\n{_build_transcript_context(interview_entries)}\n\n"
        f"Answered questions:\n{_build_decisions_context(session_record)}\n\n"
        "Build the WorkMap now."
    )

    response = await client.responses.parse(
        model=config.map_model,
        input=[
            {"role": "system", "content": _DRAFT_SYSTEM},
            {"role": "user", "content": user_text},
        ],
        text_format=_DraftMapOutput,
        text={"verbosity": "low"},
        reasoning={"effort": "low"},
        max_output_tokens=4000,
    )
    output: _DraftMapOutput = response.output_parsed

    steps: list[Step] = []
    all_gaps: list[Gap] = []
    step_order_to_id: dict[int, str] = {}

    for draft_step in output.steps:
        step, extra_gaps = _validate_draft_step(
            draft_step, session_record.snapshots, interview_entries
        )
        steps.append(step)
        step_order_to_id[draft_step.order] = step.id
        all_gaps.extend(extra_gaps)

    for draft_gap in output.gaps:
        gap = _validate_draft_gap(draft_gap, step_order_to_id, session_record.decisions)
        if gap is not None:
            all_gaps.append(gap)

    if len(all_gaps) < 3:
        steps_summary = "\n".join(
            f"{s.order}. {s.title}: {s.decision}" for s in steps
        )
        extra_response = await client.responses.parse(
            model=config.map_model,
            input=[
                {"role": "system", "content": _EXTRA_GAPS_SYSTEM},
                {"role": "user", "content": f"Process steps:\n{steps_summary}\n\nGenerate 3 gap questions."},
            ],
            text_format=_DraftMapOutput,
            text={"verbosity": "low"},
            reasoning={"effort": "low"},
            max_output_tokens=500,
        )
        extra_output: _DraftMapOutput = extra_response.output_parsed
        for draft_gap in extra_output.gaps:
            gap = _validate_draft_gap(draft_gap, step_order_to_id, session_record.decisions)
            if gap is not None:
                all_gaps.append(gap)

    work_map = WorkMap(
        session_id=session_record.session_id,
        process_name=output.process_name,
        summary=output.summary,
        steps=steps,
    )

    return work_map, all_gaps


async def apply_answer(
    work_map: WorkMap,
    gaps: list[Gap],
    gap_id: str,
    answer_text: str,
    all_transcript: list[TranscriptEntry],
    client: AsyncOpenAI,
) -> tuple[WorkMap, list[Gap], Optional[Gap]]:
    gap = next((g for g in gaps if g.id == gap_id), None)
    if gap is None:
        return work_map, gaps, None

    debrief_entries = [e for e in all_transcript if e.phase == TranscriptPhase.debrief]

    steps_summary = "\n".join(
        f"[id={s.id}] {s.order}. {s.title}: {s.decision} (confidence={s.confidence:.2f})"
        for s in work_map.steps
    )

    user_text = (
        f"Current map steps:\n{steps_summary}\n\n"
        f"Gap question: {gap.question}\n\n"
        f"Expert answer: {answer_text}\n\n"
        f"Debrief transcript so far:\n{_build_transcript_context(debrief_entries)}\n\n"
        "If this answer clarifies a step, provide the step_id, reason_update, verbatim quote, and new_confidence. "
        "If it reveals a new guardrail, provide new_guardrail with a verbatim quote from the answer. "
        "If a follow-up question is needed, provide follow_up_gap (at most one)."
    )

    response = await client.responses.parse(
        model=config.map_model,
        input=[
            {"role": "system", "content": "You apply expert answers to refine a work process map."},
            {"role": "user", "content": user_text},
        ],
        text_format=_ApplyAnswerOutput,
        text={"verbosity": "low"},
        reasoning={"effort": "low"},
        max_output_tokens=800,
    )
    output: _ApplyAnswerOutput = response.output_parsed

    updated_steps = list(work_map.steps)

    if output.step_id and output.reason_update:
        quote_t: Optional[float] = None
        if output.quote:
            quote_t = _find_quote(output.quote, debrief_entries)
            if quote_t is None:
                quote_t = _find_quote(output.quote, all_transcript)

        updated_steps = []
        for s in work_map.steps:
            if s.id == output.step_id:
                new_confidence = output.new_confidence if output.new_confidence is not None else min(s.confidence + 0.2, 1.0)
                updated_steps.append(
                    s.model_copy(update={
                        "reason": StepReason(
                            text=output.reason_update,
                            quote=output.quote if quote_t is not None else s.reason.quote,
                            quote_t=quote_t if quote_t is not None else s.reason.quote_t,
                            unconfirmed=quote_t is None and output.quote is None,
                        ),
                        "confidence": new_confidence,
                    })
                )
            else:
                updated_steps.append(s)

    updated_guardrails_added = False
    new_guardrail_gap: Optional[Gap] = None
    if output.new_guardrail:
        g_quote_t = _find_quote(output.new_guardrail.quote, debrief_entries)
        if g_quote_t is None:
            g_quote_t = _find_quote(output.new_guardrail.quote, all_transcript)
        if g_quote_t is None:
            new_guardrail_gap = Gap(
                id=str(uuid.uuid4()),
                kind=GapKind.unclear_guardrail,
                question=f"The rule '{output.new_guardrail.rule}' could not be verified. Can you confirm?",
                priority=GapPriority.high,
            )
        else:
            if output.step_id:
                new_guardrail = Guardrail(
                    id=str(uuid.uuid4()),
                    kind=output.new_guardrail.kind,
                    rule=output.new_guardrail.rule,
                    quote=output.new_guardrail.quote,
                    quote_t=g_quote_t,
                    who_to_ask=output.new_guardrail.who_to_ask,
                    applies_to=output.new_guardrail.applies_to,
                )
                updated_steps = [
                    s.model_copy(update={"guardrails": [*s.guardrails, new_guardrail]})
                    if s.id == output.step_id else s
                    for s in updated_steps
                ]
                updated_guardrails_added = True

    updated_map = work_map.model_copy(update={"steps": updated_steps})

    updated_gaps = []
    for g in gaps:
        if g.id == gap_id:
            updated_gaps.append(g.model_copy(update={"closed": True}))
        else:
            updated_gaps.append(g)

    follow_up: Optional[Gap] = None
    if output.follow_up_gap and not new_guardrail_gap:
        step_order_to_id = {s.order: s.id for s in updated_map.steps}
        fo = output.follow_up_gap
        step_id = step_order_to_id.get(fo.step_order) if fo.step_order is not None else None
        follow_up = Gap(
            id=str(uuid.uuid4()),
            step_id=step_id,
            kind=fo.kind,
            question=fo.question,
            priority=fo.priority,
        )
        updated_gaps.append(follow_up)

    if new_guardrail_gap:
        updated_gaps.append(new_guardrail_gap)
        follow_up = new_guardrail_gap

    return updated_map, updated_gaps, follow_up


async def generate_teachback(work_map: WorkMap, client: AsyncOpenAI) -> str:
    steps_text = "\n".join(
        f"{s.order}. {s.title}\n"
        f"   Decision: {s.decision}\n"
        f"   Reason: {s.reason.text}"
        + (f"\n   Expert said: \"{s.reason.quote}\"" if s.reason.quote else "")
        + (
            "\n   Guardrails:\n" + "\n".join(
                f"   - [{g.kind.value}] {g.rule}"
                + (f" (ask {g.who_to_ask})" if g.who_to_ask else "")
                for g in s.guardrails
            )
            if s.guardrails else ""
        )
        for s in work_map.steps
    )

    user_text = (
        f"Process: {work_map.process_name}\n"
        f"Summary: {work_map.summary}\n\n"
        f"Steps:\n{steps_text}\n\n"
        "Generate a ~200-word plain-text teachback that walks through each step, "
        "names the decision, the reason, and any guardrails with who to ask. "
        "Speak directly to the expert as if verifying your understanding."
    )

    response = await client.responses.create(
        model=config.map_model,
        input=[
            {"role": "system", "content": "You generate concise teachback summaries of expert processes."},
            {"role": "user", "content": user_text},
        ],
        text={"verbosity": "low"},
        reasoning={"effort": "low"},
        max_output_tokens=600,
    )
    return response.output_text


async def classify_reply(
    reply_text: str,
    work_map: WorkMap,
    all_transcript: list[TranscriptEntry],
    client: AsyncOpenAI,
) -> tuple[_ReplyOutput, WorkMap]:
    steps_summary = "\n".join(
        f"{s.order}. {s.title}: {s.decision}" for s in work_map.steps
    )

    user_text = (
        f"WorkMap steps:\n{steps_summary}\n\n"
        f"Expert reply to teachback: {reply_text}\n\n"
        "Classify this reply as: "
        "'confirmed' (the expert agrees), "
        "'corrected' (the expert corrects something — extract the correction and a verbatim quote), "
        "or 'unclear' (ambiguous, need to re-read). "
        "If corrected, provide a partial_teachback re-stating just the corrected step."
    )

    response = await client.responses.parse(
        model=config.map_model,
        input=[
            {"role": "system", "content": "You classify expert feedback on process descriptions."},
            {"role": "user", "content": user_text},
        ],
        text_format=_ReplyOutput,
        text={"verbosity": "low"},
        reasoning={"effort": "low"},
        max_output_tokens=600,
    )
    output: _ReplyOutput = response.output_parsed

    updated_map = work_map
    if output.classification == "corrected" and output.correction:
        if output.correction_quote:
            quote_t = _find_quote(output.correction_quote, all_transcript)
        else:
            quote_t = None

        updated_steps = []
        for s in work_map.steps:
            if output.correction and s.title.lower() in output.correction.lower():
                updated_steps.append(
                    s.model_copy(update={
                        "reason": StepReason(
                            text=output.correction,
                            quote=output.correction_quote,
                            quote_t=quote_t,
                            unconfirmed=quote_t is None and output.correction_quote is not None,
                        )
                    })
                )
            else:
                updated_steps.append(s)

        updated_map = work_map.model_copy(update={"steps": updated_steps, "version": work_map.version + 1})

    return output, updated_map
