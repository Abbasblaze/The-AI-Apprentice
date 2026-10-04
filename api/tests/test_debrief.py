from __future__ import annotations

import uuid
from typing import Literal

import pytest
from pydantic import BaseModel

from app.schemas import (
    DebriefPhase,
    DebriefState,
    Gap,
    GapKind,
    GapPriority,
    SnapshotIndex,
    Step,
    ScreenMoment,
    StepReason,
    TranscriptEntry,
    TranscriptPhase,
    TranscriptRole,
    WorkMap,
    StoredDecision,
    QuestionKind,
)
from app.services.map_service import (
    _find_quote,
    _snapshot_exists,
    _should_move_to_teachback,
)


def _make_entry(message: str, t: float = 0.0, phase: TranscriptPhase = TranscriptPhase.interview) -> TranscriptEntry:
    return TranscriptEntry(role=TranscriptRole.user, message=message, t=t, phase=phase)


def _make_step(confidence: float = 0.9) -> Step:
    return Step(
        id=str(uuid.uuid4()),
        order=1,
        title="Test step",
        screen_moment=ScreenMoment(t=10.0, snapshot_t=20.0, subject="Invoice"),
        decision="Approved the invoice",
        reason=StepReason(text="Because it matched the PO", quote=None, quote_t=None, unconfirmed=False),
        is_judgment_call=False,
        guardrails=[],
        confidence=confidence,
    )


def _make_gap(priority: GapPriority = GapPriority.normal, closed: bool = False) -> Gap:
    return Gap(
        id=str(uuid.uuid4()),
        kind=GapKind.missing_reason,
        question="Why did you do that?",
        priority=priority,
        closed=closed,
    )


def _make_decision(answered: bool, question: str = "Why?") -> StoredDecision:
    return StoredDecision(
        id=str(uuid.uuid4()),
        t=0.0,
        should_ask=True,
        kind=QuestionKind.reason,
        anchor_event_id=str(uuid.uuid4()),
        question=question,
        why="test",
        answered=answered,
        answer_text="Because of policy" if answered else None,
    )


class TestFindQuote:
    def test_finds_exact_match(self):
        entries = [_make_entry("The vendor is in the marketing division", t=5.0)]
        result = _find_quote("vendor is in the marketing division", entries)
        assert result == 5.0

    def test_finds_after_normalization(self):
        entries = [_make_entry("You never approve an invoice — ever!", t=10.0)]
        result = _find_quote("You never approve an invoice ever", entries)
        assert result == 10.0

    def test_returns_none_on_no_match(self):
        entries = [_make_entry("Something unrelated", t=5.0)]
        result = _find_quote("completely different text", entries)
        assert result is None

    def test_returns_none_for_empty_quote(self):
        entries = [_make_entry("Some message", t=5.0)]
        result = _find_quote("", entries)
        assert result is None

    def test_returns_none_for_empty_entries(self):
        result = _find_quote("any quote", [])
        assert result is None


class TestSnapshotExists:
    def test_passes_exact_match(self):
        snapshots = [SnapshotIndex(t=20.0, filename="20.000.jpg")]
        assert _snapshot_exists(20.0, snapshots) is True

    def test_passes_within_half_second(self):
        snapshots = [SnapshotIndex(t=20.0, filename="20.000.jpg")]
        assert _snapshot_exists(20.4, snapshots) is True

    def test_fails_outside_half_second(self):
        snapshots = [SnapshotIndex(t=20.0, filename="20.000.jpg")]
        assert _snapshot_exists(20.6, snapshots) is False

    def test_fails_empty_snapshots(self):
        assert _snapshot_exists(20.0, []) is False


class TestConfidenceCapping:
    def test_step_with_no_quote_capped_to_0_4(self):
        from app.services.map_service import _validate_draft_step, _DraftStep, _DraftReason

        draft = _DraftStep(
            order=1,
            title="Open inbox",
            event_t=10.0,
            screen_subject="Invoice Inbox",
            decision="Opened inbox",
            reason=_DraftReason(text="Standard start of process", quote=None),
            is_judgment_call=False,
            guardrails=[],
            confidence=0.9,
        )
        snapshots = [SnapshotIndex(t=10.0, filename="10.000.jpg")]
        entries = [_make_entry("Standard start of process", t=5.0)]

        step, _ = _validate_draft_step(draft, snapshots, entries)
        assert step.confidence <= 0.4
        assert step.reason.unconfirmed is True

    def test_step_with_valid_quote_keeps_confidence(self):
        from app.services.map_service import _validate_draft_step, _DraftStep, _DraftReason

        draft = _DraftStep(
            order=1,
            title="Approve invoice",
            event_t=50.0,
            screen_subject="INV-4471",
            decision="Approved",
            reason=_DraftReason(
                text="Vendor is in marketing division",
                quote="vendor is in the marketing division",
            ),
            is_judgment_call=False,
            guardrails=[],
            confidence=0.85,
        )
        snapshots = [SnapshotIndex(t=50.0, filename="50.000.jpg")]
        entries = [_make_entry("The vendor is in the marketing division so it belongs to CC-200", t=68.0)]

        step, _ = _validate_draft_step(draft, snapshots, entries)
        assert step.confidence == 0.85
        assert step.reason.unconfirmed is False


class TestStoppingRule:
    def _make_state(
        self,
        gaps_answered: int,
        gaps: list[Gap] | None = None,
        steps: list[Step] | None = None,
    ) -> DebriefState:
        default_steps = steps or [_make_step(0.9)]
        default_gaps = gaps or []
        work_map = WorkMap(
            session_id="test",
            process_name="Test process",
            summary="Test",
            steps=default_steps,
        )
        return DebriefState(
            phase=DebriefPhase.gathering,
            gaps=default_gaps,
            gaps_answered=gaps_answered,
            map=work_map,
        )

    def test_returns_false_when_gaps_answered_less_than_3(self):
        state = self._make_state(gaps_answered=2)
        move, _ = _should_move_to_teachback(state)
        assert move is False

    def test_returns_true_when_all_steps_confident_and_3_answered(self):
        state = self._make_state(gaps_answered=3, steps=[_make_step(0.9)])
        move, reason = _should_move_to_teachback(state)
        assert move is True
        assert reason == "all steps clear"

    def test_returns_true_at_exactly_8_gaps_answered(self):
        state = self._make_state(gaps_answered=8)
        move, reason = _should_move_to_teachback(state)
        assert move is True
        assert "hard stop" in reason

    def test_returns_false_when_high_priority_gap_still_open(self):
        high_gap = _make_gap(priority=GapPriority.high, closed=False)
        state = self._make_state(gaps_answered=5, gaps=[high_gap], steps=[_make_step(0.95)])
        move, _ = _should_move_to_teachback(state)
        assert move is False

    def test_returns_true_when_all_high_gaps_closed(self):
        high_gap = _make_gap(priority=GapPriority.high, closed=True)
        state = self._make_state(gaps_answered=3, gaps=[high_gap], steps=[_make_step(0.9)])
        move, reason = _should_move_to_teachback(state)
        assert move is True

    def test_returns_false_when_step_confidence_below_threshold(self):
        state = self._make_state(gaps_answered=3, steps=[_make_step(0.7)])
        move, _ = _should_move_to_teachback(state)
        assert move is False


class TestReplyOutputSchema:
    def test_parses_confirmed(self):
        from app.services.map_service import _ReplyOutput
        obj = _ReplyOutput(classification="confirmed")
        assert obj.classification == "confirmed"
        assert obj.correction is None

    def test_parses_corrected(self):
        from app.services.map_service import _ReplyOutput
        obj = _ReplyOutput(
            classification="corrected",
            correction="The threshold is 15000 not 10000",
            correction_quote="fifteen thousand",
        )
        assert obj.classification == "corrected"
        assert obj.correction is not None

    def test_parses_unclear(self):
        from app.services.map_service import _ReplyOutput
        obj = _ReplyOutput(classification="unclear")
        assert obj.classification == "unclear"


class TestOffRecordExclusion:
    def test_debrief_entries_have_debrief_phase(self):
        entry = _make_entry("Some debrief answer", t=300.0, phase=TranscriptPhase.debrief)
        assert entry.phase == TranscriptPhase.debrief

    def test_interview_entries_excluded_from_debrief_filter(self):
        entries = [
            _make_entry("interview answer", t=60.0, phase=TranscriptPhase.interview),
            _make_entry("debrief answer", t=300.0, phase=TranscriptPhase.debrief),
        ]
        debrief_only = [e for e in entries if e.phase == TranscriptPhase.debrief]
        interview_only = [e for e in entries if e.phase == TranscriptPhase.interview]
        assert len(debrief_only) == 1
        assert len(interview_only) == 1
        assert debrief_only[0].message == "debrief answer"


class TestDuplicateGapRejection:
    def test_overlapping_question_rejected(self):
        from app.services.map_service import _overlaps_answered
        decisions = [_make_decision(answered=True, question="You moved invoice 4471 to cost center CC-200")]
        assert _overlaps_answered("invoice 4471 moved to cost center CC-200", decisions) is True

    def test_different_question_not_rejected(self):
        from app.services.map_service import _overlaps_answered
        decisions = [_make_decision(answered=True, question="You moved invoice 4471 to cost center CC-200")]
        assert _overlaps_answered("What is the escalation threshold for tier-2 approval?", decisions) is False

    def test_unanswered_decisions_not_counted(self):
        from app.services.map_service import _overlaps_answered
        decisions = [_make_decision(answered=False, question="You moved invoice 4471 to cost center CC-200")]
        assert _overlaps_answered("invoice 4471 moved to cost center CC-200", decisions) is False
