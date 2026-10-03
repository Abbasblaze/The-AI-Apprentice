import math
import re
import time
import uuid
from typing import Optional

from openai import AsyncOpenAI

from app.config import config
from app.schemas import (
    AppEvent,
    DirectorDecideResponse,
    DirectorDecisionOutput,
    QuestionKind,
    StoredDecision,
    TranscriptEntry,
)

_client = AsyncOpenAI(api_key=config.openai_api_key)

_BUDGET_QUESTIONS = 5
_BUDGET_WINDOW_SECONDS = 600.0
_GUARDRAIL_FORCE_AFTER_SECONDS = 240.0

_SYSTEM_PROMPT = (
    "You are a silent observer watching an expert work. "
    "Your job is to identify one precise moment that deserves a short follow-up question. "
    "Pick decisions, not routine actions: a value that changed, a record moved, a step skipped, an item held. "
    "Phrase the question around the specific visible detail — one short sentence, not answerable with yes or no. "
    "Good: 'You moved invoice 4471 to a different cost center. What made you do that?' "
    "Bad: 'Why did you do that?' or 'What are you doing?' "
    "If no event is interesting enough, set should_ask to false. "
    "Skip questions whose answers are already visible in the events. "
    "anchor_event_id must be the exact id of the event you are asking about. "
    "If should_ask is false, set anchor_event_id, question, and why to empty strings. "
    "kind must be one of: reason, limit, exception, escalation, guardrail. "
    "Use guardrail when asking about an action that could cause harm or data loss."
)

_STOPWORDS = frozenset({
    "a", "an", "the", "is", "are", "was", "were", "you", "your",
    "did", "do", "does", "what", "why", "how", "when", "where",
    "that", "this", "it", "to", "of", "in", "on", "at", "for",
    "and", "or", "but", "so", "if", "then", "made", "about",
})


def _within_budget(elapsed_seconds: float, decisions: list[StoredDecision]) -> bool:
    window_start = elapsed_seconds - _BUDGET_WINDOW_SECONDS
    in_window = [d for d in decisions if d.should_ask and d.t >= max(0.0, window_start)]
    return len(in_window) < _BUDGET_QUESTIONS


def _should_force_guardrail(elapsed_seconds: float, decisions: list[StoredDecision]) -> bool:
    if elapsed_seconds < _GUARDRAIL_FORCE_AFTER_SECONDS:
        return False
    return not any(d.should_ask and d.kind == QuestionKind.guardrail for d in decisions)


def _valid_anchor(anchor_event_id: str, events: list[AppEvent]) -> bool:
    return any(e.id == anchor_event_id for e in events)


def _significant_words(text: str) -> frozenset[str]:
    tokens = set(re.findall(r"\b\w+\b", text.lower()))
    return frozenset(tokens - _STOPWORDS)


def _is_repeat(question: str, previous_questions: list[str]) -> bool:
    new_words = _significant_words(question)
    if not new_words:
        return False
    for prev in previous_questions:
        prev_words = _significant_words(prev)
        if not prev_words:
            continue
        overlap = len(new_words & prev_words) / min(len(new_words), len(prev_words))
        if overlap > 0.6:
            return True
    return False


def _build_events_context(events: list[AppEvent]) -> str:
    recent = events[-25:]
    if not recent:
        return "No screen events yet."
    return "\n".join(
        f"[id={e.id}] [{e.t:.1f}s] {e.kind.value}: {e.summary}"
        + (f" | field={e.field}" if e.field else "")
        + (f" | {e.from_value} → {e.to_value}" if e.from_value or e.to_value else "")
        for e in recent
    )


def _build_transcript_context(entries: list[TranscriptEntry]) -> str:
    if not entries:
        return "No conversation yet."
    return "\n".join(f"[{e.t:.1f}s] {e.role.value}: {e.message}" for e in entries[-20:])


def _build_questions_context(decisions: list[StoredDecision]) -> str:
    asked = [d for d in decisions if d.should_ask]
    if not asked:
        return "No questions asked yet."
    return "\n".join(f"- {d.question}" for d in asked)


async def decide(
    session_id: str,
    elapsed_seconds: float,
    events: list[AppEvent],
    transcript: list[TranscriptEntry],
    decisions: list[StoredDecision],
) -> tuple[DirectorDecideResponse, StoredDecision]:
    asked_questions = [d for d in decisions if d.should_ask]

    if not _within_budget(elapsed_seconds, decisions):
        stored = StoredDecision(
            id=str(uuid.uuid4()),
            t=elapsed_seconds,
            should_ask=False,
            kind=QuestionKind.reason,
            anchor_event_id="",
            question="",
            why="budget exhausted",
            rejected_reason="question budget exhausted",
        )
        return (
            DirectorDecideResponse(
                should_ask=False,
                kind=QuestionKind.reason,
                anchor_event_id="",
                question="",
                why="budget exhausted",
                rejected_reason="question budget exhausted",
            ),
            stored,
        )

    force_guardrail = _should_force_guardrail(elapsed_seconds, decisions)

    user_text = (
        f"Elapsed: {elapsed_seconds:.0f}s\n\n"
        f"Screen events (most recent last):\n{_build_events_context(events)}\n\n"
        f"Conversation so far:\n{_build_transcript_context(transcript)}\n\n"
        f"Questions already asked:\n{_build_questions_context(decisions)}\n\n"
        + (
            "IMPORTANT: At least 4 minutes have passed and no guardrail question has been asked. "
            "Your next question MUST have kind=guardrail.\n\n"
            if force_guardrail
            else ""
        )
        + "Decide whether to ask a question now."
    )

    start = time.perf_counter()
    response = await _client.responses.parse(
        model=config.director_model,
        input=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_text},
        ],
        text_format=DirectorDecisionOutput,
        text={"verbosity": "low"},
        reasoning={"effort": "low"},
        max_output_tokens=500,
    )
    _ = time.perf_counter() - start

    output: DirectorDecisionOutput = response.output_parsed

    if not output.should_ask:
        stored = StoredDecision(
            id=str(uuid.uuid4()),
            t=elapsed_seconds,
            should_ask=False,
            kind=output.kind,
            anchor_event_id="",
            question="",
            why=output.why,
        )
        return (
            DirectorDecideResponse(
                should_ask=False,
                kind=output.kind,
                anchor_event_id="",
                question="",
                why=output.why,
            ),
            stored,
        )

    rejected_reason: Optional[str] = None

    if not _valid_anchor(output.anchor_event_id, events):
        rejected_reason = f"anchor event {output.anchor_event_id!r} not found in session"

    elif _is_repeat(output.question, [d.question for d in asked_questions]):
        rejected_reason = "question repeats or closely rephrases a previous question"

    if rejected_reason:
        stored = StoredDecision(
            id=str(uuid.uuid4()),
            t=elapsed_seconds,
            should_ask=False,
            kind=output.kind,
            anchor_event_id=output.anchor_event_id,
            question=output.question,
            why=output.why,
            rejected_reason=rejected_reason,
        )
        return (
            DirectorDecideResponse(
                should_ask=False,
                kind=output.kind,
                anchor_event_id=output.anchor_event_id,
                question=output.question,
                why=output.why,
                rejected_reason=rejected_reason,
            ),
            stored,
        )

    final_kind = QuestionKind.guardrail if force_guardrail else output.kind

    stored = StoredDecision(
        id=str(uuid.uuid4()),
        t=elapsed_seconds,
        should_ask=True,
        kind=final_kind,
        anchor_event_id=output.anchor_event_id,
        question=output.question,
        why=output.why,
    )
    return (
        DirectorDecideResponse(
            should_ask=True,
            kind=final_kind,
            anchor_event_id=output.anchor_event_id,
            question=output.question,
            why=output.why,
        ),
        stored,
    )
