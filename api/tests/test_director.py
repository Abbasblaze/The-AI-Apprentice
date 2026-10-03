import uuid

import pytest

from app.schemas import AppEvent, EventKind, QuestionKind, StoredDecision
from app.services.director import (
    _is_repeat,
    _should_force_guardrail,
    _valid_anchor,
    _within_budget,
)


def _make_event(event_id: str = None, t: float = 0.0) -> AppEvent:
    return AppEvent(
        id=event_id or str(uuid.uuid4()),
        t=t,
        kind=EventKind.changed,
        subject="Invoice",
        field="Cost Center",
        from_value="CC-100",
        to_value="CC-200",
        summary="Changed cost center from CC-100 to CC-200",
    )


def _make_decision(
    should_ask: bool,
    kind: QuestionKind = QuestionKind.reason,
    t: float = 0.0,
    question: str = "Why did you do that?",
) -> StoredDecision:
    return StoredDecision(
        id=str(uuid.uuid4()),
        t=t,
        should_ask=should_ask,
        kind=kind,
        anchor_event_id=str(uuid.uuid4()),
        question=question,
        why="test",
    )


class TestBudget:
    def test_allows_when_no_questions_asked(self):
        assert _within_budget(300.0, []) is True

    def test_allows_up_to_five_in_window(self):
        decisions = [_make_decision(True, t=i * 30.0) for i in range(4)]
        assert _within_budget(300.0, decisions) is True

    def test_refuses_at_five_in_window(self):
        decisions = [_make_decision(True, t=i * 30.0) for i in range(5)]
        assert _within_budget(300.0, decisions) is False

    def test_allows_again_after_window_rolls(self):
        decisions = [_make_decision(True, t=i * 30.0) for i in range(5)]
        assert _within_budget(700.0, decisions) is True

    def test_declined_decisions_do_not_count(self):
        decisions = [_make_decision(False, t=i * 30.0) for i in range(10)]
        assert _within_budget(300.0, decisions) is True


class TestAnchorValidation:
    def test_accepts_matching_event_id(self):
        event = _make_event("event-abc")
        assert _valid_anchor("event-abc", [event]) is True

    def test_rejects_unknown_event_id(self):
        event = _make_event("event-abc")
        assert _valid_anchor("event-xyz", [event]) is False

    def test_rejects_when_events_empty(self):
        assert _valid_anchor("event-abc", []) is False


class TestRepeatRejection:
    def test_allows_different_question(self):
        prev = ["You moved the record to a different folder. What caused that?"]
        new = "Why was the invoice sent to accounts payable instead of purchasing?"
        assert _is_repeat(new, prev) is False

    def test_rejects_near_identical_question(self):
        prev = ["You moved invoice 4471 to a different cost center. What made you do that?"]
        new = "You moved invoice 4471 to a different cost center. Why did you do that?"
        assert _is_repeat(new, prev) is True

    def test_allows_when_no_previous_questions(self):
        assert _is_repeat("Any question?", []) is False

    def test_rejects_high_overlap(self):
        prev = ["Why did you escalate the purchase order to tier-2 approval?"]
        new = "Why did you escalate the purchase order to tier-2 approval level?"
        assert _is_repeat(new, prev) is True


class TestForcedGuardrail:
    def test_no_force_before_4_minutes(self):
        assert _should_force_guardrail(200.0, []) is False

    def test_force_after_4_minutes_with_no_guardrail(self):
        decisions = [_make_decision(True, kind=QuestionKind.reason, t=100.0)]
        assert _should_force_guardrail(250.0, decisions) is True

    def test_no_force_if_guardrail_already_asked(self):
        decisions = [_make_decision(True, kind=QuestionKind.guardrail, t=100.0)]
        assert _should_force_guardrail(300.0, decisions) is False

    def test_exactly_at_threshold(self):
        assert _should_force_guardrail(240.0, []) is True

    def test_declined_guardrail_does_not_satisfy(self):
        decisions = [_make_decision(False, kind=QuestionKind.guardrail, t=100.0)]
        assert _should_force_guardrail(300.0, decisions) is True
