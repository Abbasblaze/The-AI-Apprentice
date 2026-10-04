from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from app.schemas import (
    DebriefState,
    Gap,
    GapKind,
    GuardrailKind,
    WorkMap,
)

_GAP_KIND_LABELS: dict[GapKind, str] = {
    GapKind.missing_reason: "reason not captured",
    GapKind.unclear_guardrail: "guardrail not confirmed",
    GapKind.scope: "scope not confirmed",
    GapKind.authority: "authority not confirmed",
    GapKind.unseen_case: "case not demonstrated",
    GapKind.never_do: "never-do not confirmed",
}

_DEFAULT_NOT_COVERED = [
    {"id": "scope", "question": "When does this process NOT apply?", "kind": "scope", "note": "scope not confirmed"},
    {"id": "authority", "question": "Who must approve exceptions?", "kind": "authority", "note": "authority not confirmed"},
    {"id": "never_do", "question": "What action would be catastrophic and must never be done?", "kind": "never_do", "note": "never-do not confirmed"},
]


def _fmt_unix(ts: float) -> str:
    dt = datetime.fromtimestamp(ts, tz=timezone.utc)
    return dt.strftime("%d %b %Y %H:%M UTC")


def _fmt_t(t: float) -> str:
    m = int(t) // 60
    s = int(t) % 60
    return f"{m:02d}:{s:02d}"


def _open_gaps(state: Optional[DebriefState]) -> list[Gap]:
    if state is None:
        return []
    return [g for g in state.gaps if not g.closed]


def build_markdown(work_map: WorkMap, debrief_state: Optional[DebriefState]) -> str:
    confirmed_at_str = _fmt_unix(work_map.confirmed_at) if work_map.confirmed_at else "date unknown"
    lines: list[str] = []

    lines.append(f"# {work_map.process_name}")
    lines.append(f"**Confirmed by the expert · {confirmed_at_str}**")
    lines.append("")
    lines.append("## Goal")
    lines.append(work_map.summary)
    lines.append("")
    lines.append("## Steps")
    lines.append("")

    for step in sorted(work_map.steps, key=lambda s: s.order):
        lines.append(f"### {step.order}. {step.title}")
        lines.append(f"**When:** {step.screen_moment.subject} (at {_fmt_t(step.screen_moment.t)} in session)")
        lines.append(f"**What:** {step.decision}")
        lines.append(f"**Why:** {step.reason.text}")
        if step.reason.quote:
            lines.append(f'**Expert said:** "{step.reason.quote}"')
        if step.is_judgment_call:
            lines.append("**Note:** This is a judgment call — the expert used personal judgment here.")

        field_guardrails = [g for g in step.guardrails if g.threshold_field and g.blocked_value]
        if field_guardrails:
            lines.append("")
            lines.append("**Fields and values:**")
            for g in field_guardrails:
                cmp_symbol = {"gt": ">", "gte": ">=", "lt": "<", "lte": "<=", "eq": "=", "ne": "≠"}.get(g.comparator or "", "")
                threshold_clause = (
                    f" when `{g.threshold_field}` {cmp_symbol} {g.threshold}"
                    if g.threshold is not None and cmp_symbol
                    else ""
                )
                lines.append(f"- Do not use `{g.blocked_value}`{threshold_clause}")

        lines.append("")
        lines.append("---")
        lines.append("")

    all_guardrails = [(step, g) for step in work_map.steps for g in step.guardrails]

    lines.append("## Hard stops")
    lines.append("")
    lines.append("Never violate these rules. Stop and do not proceed if you reach one.")
    lines.append("")

    if all_guardrails:
        for i, (step, g) in enumerate(all_guardrails, 1):
            lines.append(f"### {i}. {g.rule}")
            lines.append(f"- **Kind:** {g.kind.value.replace('_', ' ')}")
            if g.applies_to:
                lines.append(f"- **Applies to:** {g.applies_to}")
            if g.blocked_value:
                lines.append(f"- **Do not use:** `{g.blocked_value}`")
            if g.who_to_ask:
                lines.append(f"- **Ask:** {g.who_to_ask}")
            lines.append(f'- **Expert said:** "{g.quote}"')
            lines.append("")
    else:
        lines.append("No explicit hard stops were captured in this session.")
        lines.append("")

    stop_and_ask_guardrails = [
        (step, g) for step, g in all_guardrails if g.kind == GuardrailKind.stop_and_ask
    ]

    lines.append("## Stop and ask a person")
    lines.append("")

    if stop_and_ask_guardrails:
        lines.append("Stop immediately and escalate when:")
        lines.append("")
        for _step, g in stop_and_ask_guardrails:
            who = g.who_to_ask or "the responsible person"
            lines.append(f"- **{g.rule}**")
            lines.append(f"  - Ask: {who}")
            lines.append(f'  - Expert said: "{g.quote}"')
            lines.append("")
    else:
        lines.append("Stop and escalate when:")
        lines.append("")
        lines.append("- Any situation arises that is not explicitly covered by the rules above")
        lines.append("- The guardrail conditions apply and you are not certain how to proceed")
        lines.append("")
        who_set = sorted({g.who_to_ask for _, g in all_guardrails if g.who_to_ask})
        if who_set:
            lines.append(f"Ask: {', '.join(who_set)}")
            lines.append("")

    open_gaps = _open_gaps(debrief_state)

    lines.append("## Not covered")
    lines.append("")
    lines.append("The expert did not demonstrate or confirm these cases.")
    lines.append("Stop and ask a person when they arise — do not guess.")
    lines.append("")

    if open_gaps:
        for gap in open_gaps:
            label = _GAP_KIND_LABELS.get(gap.kind, gap.kind.value)
            lines.append(f"- {gap.question} *({label})*")
    else:
        for item in _DEFAULT_NOT_COVERED:
            lines.append(f"- {item['question']} *({item['note']})*")

    lines.append("")

    return "\n".join(lines)


def build_json(work_map: WorkMap, debrief_state: Optional[DebriefState]) -> dict:
    confirmed_at_str = _fmt_unix(work_map.confirmed_at) if work_map.confirmed_at else None

    steps_out = []
    for step in sorted(work_map.steps, key=lambda s: s.order):
        steps_out.append({
            "id": step.id,
            "order": step.order,
            "title": step.title,
            "when": f"{step.screen_moment.subject} (at {_fmt_t(step.screen_moment.t)} in session)",
            "what": step.decision,
            "why": step.reason.text,
            "expert_quote": step.reason.quote,
            "is_judgment_call": step.is_judgment_call,
            "fields": [
                {
                    "blocked_value": g.blocked_value,
                    "threshold_field": g.threshold_field,
                    "threshold": g.threshold,
                    "comparator": g.comparator,
                    "applies_when": g.applies_to,
                }
                for g in step.guardrails
                if g.threshold_field and g.blocked_value
            ],
        })

    all_guardrails = [(step, g) for step in work_map.steps for g in step.guardrails]

    hard_stops_out = [
        {
            "id": g.id,
            "step_id": step.id,
            "kind": g.kind.value,
            "rule": g.rule,
            "applies_to": g.applies_to,
            "what_not_to_do": g.blocked_value,
            "ask": g.who_to_ask,
            "expert_quote": g.quote,
        }
        for step, g in all_guardrails
    ]

    stop_and_ask_out = [
        {
            "id": g.id,
            "rule": g.rule,
            "ask": g.who_to_ask,
            "expert_quote": g.quote,
        }
        for _, g in all_guardrails
        if g.kind == GuardrailKind.stop_and_ask
    ]
    if not stop_and_ask_out:
        default_ask = next((g.who_to_ask for _, g in all_guardrails if g.who_to_ask), "the responsible person")
        stop_and_ask_out = [
            {
                "id": "default",
                "rule": "Any situation not covered by the rules above",
                "ask": default_ask,
                "expert_quote": None,
            }
        ]

    open_gaps = _open_gaps(debrief_state)
    if open_gaps:
        not_covered_out = [
            {
                "id": gap.id,
                "question": gap.question,
                "kind": gap.kind.value,
                "note": _GAP_KIND_LABELS.get(gap.kind, gap.kind.value),
            }
            for gap in open_gaps
        ]
    else:
        not_covered_out = list(_DEFAULT_NOT_COVERED)

    return {
        "export_version": "1",
        "process_name": work_map.process_name,
        "confirmed_by": "the expert",
        "confirmed_at": confirmed_at_str,
        "goal": work_map.summary,
        "steps": steps_out,
        "hard_stops": hard_stops_out,
        "stop_and_ask": stop_and_ask_out,
        "not_covered": not_covered_out,
    }
