from __future__ import annotations

import asyncio
import json
from operator import eq, ge, gt, le, lt, ne
from typing import Literal, Optional

from openai import AsyncOpenAI
from pydantic import BaseModel

from app.schemas import (
    CheckVerdict,
    Guardrail,
    GuardrailMastery,
    MasterySummary,
    PredictionResult,
    Step,
    StepMastery,
    TutorSession,
    WorkMap,
)


class InvoiceStateIn(BaseModel):
    supplier: str
    country: str
    amount: float
    cost_center: str
    asset_number: str
    status: str
    internal_note: str


class _JudgeOutput(BaseModel):
    verdict: Literal["allow", "block"]
    guardrail_id: Optional[str] = None
    step_id: Optional[str] = None
    asks_why: str


class _PredictionEvalOutput(BaseModel):
    result: PredictionResult
    reasoning: str


_verdict_cache: dict[str, CheckVerdict] = {}

_OPS = {"gt": gt, "gte": ge, "lt": lt, "lte": le, "eq": eq, "ne": ne}


def _fmt_t(t: float) -> str:
    m = int(t) // 60
    s = int(t) % 60
    return f"{m:02d}:{s:02d}"


def _numeric_verdict(
    guardrail: Guardrail,
    invoice: InvoiceStateIn,
    action_type: str,
    action_value: Optional[str],
) -> Optional[Literal["block"]]:
    if guardrail.threshold is None or not guardrail.comparator or not guardrail.threshold_field:
        return None
    value = getattr(invoice, guardrail.threshold_field, None)
    if value is None or not isinstance(value, (int, float)):
        return None
    fn = _OPS.get(guardrail.comparator)
    if not fn or not fn(value, guardrail.threshold):
        return None
    if guardrail.blocked_value:
        if action_type == "change_cost_center" and action_value == guardrail.blocked_value:
            return "block"
        if action_type in ("send_for_approval", "post") and invoice.cost_center == guardrail.blocked_value:
            return "block"
        return None
    return "block"


def _all_guardrails(work_map: WorkMap) -> list[tuple[str, Guardrail]]:
    result: list[tuple[str, Guardrail]] = []
    for step in work_map.steps:
        for g in step.guardrails:
            result.append((step.id, g))
    return result


def _build_explanation(guardrail: Guardrail) -> str:
    return f"{guardrail.rule} Expert said: \"{guardrail.quote}\" [{_fmt_t(guardrail.quote_t)}]"


async def judge_action(
    tutor_session_id: str,
    action_type: str,
    action_value: Optional[str],
    invoice: InvoiceStateIn,
    work_map: WorkMap,
    client: AsyncOpenAI,
) -> CheckVerdict:
    for step_id, guardrail in _all_guardrails(work_map):
        result = _numeric_verdict(guardrail, invoice, action_type, action_value)
        if result == "block":
            return CheckVerdict(
                verdict="block",
                guardrail_id=guardrail.id,
                step_id=step_id,
                explanation=_build_explanation(guardrail),
                asks_why="Sabine would stop here. Why do you think?",
            )

    invoice_json = json.dumps(invoice.model_dump(), sort_keys=True)
    cache_key = f"{tutor_session_id}:{action_type}:{action_value}:{invoice_json}"
    if cache_key in _verdict_cache:
        cached = _verdict_cache[cache_key]
        return cached.model_copy(update={"from_cache": True})

    guardrail_map: dict[str, tuple[str, Guardrail]] = {}
    for step_id, g in _all_guardrails(work_map):
        guardrail_map[g.id] = (step_id, g)

    guardrails_text = "\n".join(
        f"- id={g.id} step={sid} rule={g.rule}"
        for sid, g in guardrail_map.values()
    )

    system_prompt = (
        "You are a tutor judge. Evaluate if the given ERP action violates any guardrail in the work map. "
        "Return the guardrail_id only if you are certain the action violates it. "
        "Return asks_why as a brief Socratic question to prompt reflection."
    )
    user_prompt = (
        f"Action: {action_type}, value: {action_value}\n"
        f"Invoice: {invoice_json}\n"
        f"Guardrails:\n{guardrails_text or 'none'}"
    )

    try:
        response = await asyncio.wait_for(
            client.responses.parse(
                model="gpt-5-nano",
                input=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                text_format=_JudgeOutput,
                text={"verbosity": "low"},
                reasoning={"effort": "low"},
                max_output_tokens=300,
            ),
            timeout=4.0,
        )
        output: _JudgeOutput = response.output_parsed
    except asyncio.TimeoutError:
        return CheckVerdict(
            verdict="allow",
            explanation="Tutor unavailable",
            asks_why="",
            timeout=True,
        )

    if output.verdict == "block" and output.guardrail_id:
        entry = guardrail_map.get(output.guardrail_id)
        if entry is None:
            verdict = CheckVerdict(
                verdict="allow",
                explanation="",
                asks_why="",
            )
        else:
            cited_step_id, cited_guardrail = entry
            verdict = CheckVerdict(
                verdict="block",
                guardrail_id=cited_guardrail.id,
                step_id=cited_step_id,
                explanation=_build_explanation(cited_guardrail),
                asks_why=output.asks_why,
            )
    else:
        verdict = CheckVerdict(
            verdict="allow",
            explanation="",
            asks_why=output.asks_why,
            step_id=output.step_id,
        )

    _verdict_cache[cache_key] = verdict
    return verdict


async def evaluate_prediction(
    answer: str,
    step: Step,
    client: AsyncOpenAI,
) -> PredictionResult:
    system_prompt = (
        "You evaluate whether a trainee's prediction matches the expected step decision. "
        "Be fair but precise."
    )
    user_prompt = (
        f"Step decision: {step.decision}\n"
        f"Step reason: {step.reason.text}\n"
        f"Trainee answer: {answer}"
    )

    response = await client.responses.parse(
        model="gpt-5-nano",
        input=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        text_format=_PredictionEvalOutput,
        text={"verbosity": "low"},
        reasoning={"effort": "low"},
        max_output_tokens=200,
    )
    output: _PredictionEvalOutput = response.output_parsed
    return output.result


def compute_mastery(session: TutorSession, work_map: WorkMap) -> MasterySummary:
    step_map = {s.id: s for s in work_map.steps}

    step_mastery_list: list[StepMastery] = []
    mastered_steps: list[str] = []
    practice_next: list[str] = []

    for step in work_map.steps:
        predictions_for_step = [p for p in session.predictions if p.step_id == step.id]
        interventions_for_step = [i for i in session.interventions if i.step_id == step.id]

        attempted = len(predictions_for_step) > 0 or len(interventions_for_step) > 0
        predicted_correctly = any(
            p.result == PredictionResult.correct for p in predictions_for_step
        )
        blocked = sum(
            1 for i in interventions_for_step if i.verdict.verdict == "block"
        )
        corrected_after_block = blocked > 0 and any(i.corrected for i in interventions_for_step)
        hints_used = 0

        mastered = attempted and (predicted_correctly or (blocked == 0 and hints_used == 0))

        sm = StepMastery(
            step_id=step.id,
            step_title=step.title,
            attempted=attempted,
            predicted_correctly=predicted_correctly,
            blocked=blocked,
            corrected_after_block=corrected_after_block,
            hints_used=hints_used,
            mastered=mastered,
        )
        step_mastery_list.append(sm)

        if mastered:
            mastered_steps.append(step.title)
        else:
            practice_next.append(step.title)

    guardrail_mastery_list: list[GuardrailMastery] = []
    for step in work_map.steps:
        for g in step.guardrails:
            interventions_for_guardrail = [
                i for i in session.interventions if i.guardrail_id == g.id
            ]
            tested = len(interventions_for_guardrail) > 0
            passed = tested and all(
                i.verdict.verdict == "allow" for i in interventions_for_guardrail
            )
            guardrail_mastery_list.append(
                GuardrailMastery(
                    guardrail_id=g.id,
                    rule=g.rule,
                    tested=tested,
                    passed=passed,
                )
            )

    total_predictions = len(session.predictions)
    correct_predictions = sum(
        1 for p in session.predictions if p.result == PredictionResult.correct
    )
    total_interventions = len(session.interventions)
    corrected_interventions = sum(1 for i in session.interventions if i.corrected)

    mastered_count = len(mastered_steps)
    total_steps = len(work_map.steps)

    if mastered_count == total_steps:
        summary_text = (
            f"Great work — you mastered all {total_steps} steps of {work_map.process_name}. "
            f"You answered {correct_predictions} of {total_predictions} predictions correctly "
            f"with {total_interventions} guardrail interventions."
        )
    elif mastered_count == 0:
        summary_text = (
            f"You attempted {work_map.process_name} with {total_interventions} guardrail interventions. "
            f"Review the practice steps: {', '.join(practice_next[:3])}."
        )
    else:
        summary_text = (
            f"You mastered {mastered_count} of {total_steps} steps in {work_map.process_name}. "
            f"Focus next on: {', '.join(practice_next[:2])}. "
            f"{correct_predictions} of {total_predictions} predictions correct."
        )

    return MasterySummary(
        mastered_steps=mastered_steps,
        practice_next=practice_next,
        step_mastery=step_mastery_list,
        guardrail_mastery=guardrail_mastery_list,
        total_predictions=total_predictions,
        correct_predictions=correct_predictions,
        total_interventions=total_interventions,
        corrected_interventions=corrected_interventions,
        summary_text=summary_text,
    )
