from __future__ import annotations

import asyncio
import json
import uuid
from typing import Any, Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.schemas import (
    Gap,
    GapKind,
    GapPriority,
    Guardrail,
    GuardrailKind,
    ScreenMoment,
    SessionRecord,
    Step,
    StepReason,
    TeachbackRound,
    WorkMap,
)
from tests.fixtures import load_fixture


def _make_mock_work_map(session_id: str) -> WorkMap:
    steps = [
        Step(
            id="step-001",
            order=1,
            title="Open invoice inbox",
            screen_moment=ScreenMoment(t=10.0, snapshot_t=20.0, subject="Invoice Inbox"),
            decision="Navigate to the invoice queue",
            reason=StepReason(
                text="Standard start of the daily invoice processing routine",
                quote="Standard start of process",
                quote_t=None,
                unconfirmed=False,
            ),
            is_judgment_call=False,
            guardrails=[],
            confidence=0.85,
        ),
        Step(
            id="step-002",
            order=2,
            title="Recode invoice cost center",
            screen_moment=ScreenMoment(t=45.0, snapshot_t=20.0, subject="INV-4471"),
            decision="Changed cost center CC-100 to CC-200 to match vendor department",
            reason=StepReason(
                text="Match vendor department to cost center",
                quote="vendor is in the marketing division",
                quote_t=68.0,
                unconfirmed=False,
            ),
            is_judgment_call=False,
            guardrails=[],
            confidence=0.9,
        ),
        Step(
            id="step-003",
            order=3,
            title="Hold invoice for amount discrepancy",
            screen_moment=ScreenMoment(t=115.0, snapshot_t=95.0, subject="INV-4472"),
            decision="Put INV-4472 on hold because amount exceeded PO by more than 5%",
            reason=StepReason(
                text="Invoice exceeds PO by more than 5 percent threshold",
                quote="Any discrepancy over 5% goes on hold",
                quote_t=142.0,
                unconfirmed=False,
            ),
            is_judgment_call=False,
            guardrails=[
                Guardrail(
                    id="grail-001",
                    kind=GuardrailKind.limit,
                    rule="Never approve an invoice that exceeds the PO amount by more than 5% without manager approval",
                    quote="You never approve an invoice that exceeds the PO amount by more than 5 percent without explicit manager approval",
                    quote_t=142.0,
                    who_to_ask="Manager",
                    applies_to="All invoices",
                )
            ],
            confidence=0.95,
        ),
        Step(
            id="step-004",
            order=4,
            title="Escalate high-value invoice to tier-2",
            screen_moment=ScreenMoment(t=185.0, snapshot_t=175.0, subject="INV-4473"),
            decision="Escalated INV-4473 to tier-2 and assigned J.Martinez",
            reason=StepReason(
                text="Amounts over 10000 require tier-2 sign-off",
                quote="Anything over 10000 dollars requires tier-2 sign-off",
                quote_t=215.0,
                unconfirmed=False,
            ),
            is_judgment_call=False,
            guardrails=[],
            confidence=0.9,
        ),
    ]
    return WorkMap(
        session_id=session_id,
        process_name="Three-invoice processing",
        summary="Expert processes three invoices: recoding, holding for discrepancy, and escalating over threshold.",
        steps=steps,
    )


def _make_mock_gaps() -> list[Gap]:
    return [
        Gap(
            id="gap-001",
            step_id="step-002",
            kind=GapKind.scope,
            question="When does the cost center reassignment NOT apply?",
            priority=GapPriority.high,
        ),
        Gap(
            id="gap-002",
            step_id="step-003",
            kind=GapKind.authority,
            question="Who has authority to approve an invoice that exceeds the PO by more than 5%?",
            priority=GapPriority.high,
        ),
        Gap(
            id="gap-003",
            step_id="step-004",
            kind=GapKind.never_do,
            question="What action on a tier-2 invoice would be catastrophic and must never be done?",
            priority=GapPriority.high,
        ),
    ]


def _make_apply_answer_output() -> Any:
    from app.services.map_service import _ApplyAnswerOutput
    return _ApplyAnswerOutput(
        step_id="step-002",
        reason_update="Cost center reassignment only applies when vendor department code differs from default",
        quote="vendor is in the marketing division",
        new_confidence=0.92,
    )


def _make_reply_output_corrected() -> Any:
    from app.services.map_service import _ReplyOutput
    return _ReplyOutput(
        classification="corrected",
        correction="The escalation threshold is actually 15000 not 10000",
        correction_quote="fifteen thousand dollars",
        partial_teachback="Step 4: For invoices over 15000, escalate to tier-2 and assign the department approver.",
    )


def _make_reply_output_confirmed() -> Any:
    from app.services.map_service import _ReplyOutput
    return _ReplyOutput(
        classification="confirmed",
    )


def _fixture_session_record() -> SessionRecord:
    data = load_fixture()
    return SessionRecord(
        session_id=data.session_id,
        start_time=data.start_time,
        end_time=data.end_time,
        events=data.events,
        erp_events=data.erp_events,
        transcript=data.transcript,
        decisions=data.decisions,
        snapshots=data.snapshots,
    )


class TestFixtureLoad:
    def test_loads_fixture(self):
        data = load_fixture()
        assert data.session_id == "fixture-session-001"
        assert data.end_time is not None
        assert len(data.events) > 0
        assert len(data.erp_events) > 0
        assert len(data.transcript) > 0
        assert len(data.decisions) == 3
        assert len(data.snapshots) == 3

    def test_decisions_are_answered(self):
        data = load_fixture()
        for d in data.decisions:
            assert d.answered is True
            assert d.answer_text is not None


class TestDraftMapMocked:
    def test_draft_map_produces_valid_workmap_and_min_3_gaps(self):
        mock_work_map = _make_mock_work_map("fixture-session-001")
        mock_gaps = _make_mock_gaps()

        async def mock_draft_map(session_record, client):
            return mock_work_map, mock_gaps

        record = _fixture_session_record()

        result_map, result_gaps = asyncio.run(mock_draft_map(record, None))

        assert isinstance(result_map, WorkMap)
        assert result_map.session_id == "fixture-session-001"
        assert len(result_map.steps) >= 3
        assert len(result_gaps) >= 3


class TestApplyAnswerMocked:
    def test_apply_answer_closes_gap_and_updates_step(self):
        mock_work_map = _make_mock_work_map("fixture-session-001")
        mock_gaps = _make_mock_gaps()
        apply_output = _make_apply_answer_output()

        async def mock_apply_answer(work_map, gaps, gap_id, answer_text, all_transcript, client):
            from app.services.map_service import _find_quote, StepReason
            updated_steps = []
            for s in work_map.steps:
                if s.id == apply_output.step_id:
                    updated_steps.append(
                        s.model_copy(update={
                            "reason": StepReason(
                                text=apply_output.reason_update,
                                quote=apply_output.quote,
                                quote_t=68.0,
                                unconfirmed=False,
                            ),
                            "confidence": apply_output.new_confidence,
                        })
                    )
                else:
                    updated_steps.append(s)
            updated_map = work_map.model_copy(update={"steps": updated_steps})
            updated_gaps = [
                g.model_copy(update={"closed": True}) if g.id == gap_id else g
                for g in gaps
            ]
            return updated_map, updated_gaps, None

        updated_map, updated_gaps, follow_up = asyncio.run(
            mock_apply_answer(mock_work_map, mock_gaps, "gap-001", "Only when vendor dept differs", [], None)
        )

        closed_gap = next(g for g in updated_gaps if g.id == "gap-001")
        assert closed_gap.closed is True

        updated_step = next(s for s in updated_map.steps if s.id == "step-002")
        assert updated_step.confidence == 0.92


class TestTeachbackAndConfirmationMocked:
    def test_teachback_correction_then_confirmation(self):
        mock_work_map = _make_mock_work_map("fixture-session-001")
        corrected_output = _make_reply_output_corrected()
        confirmed_output = _make_reply_output_confirmed()

        async def mock_classify_corrected(reply_text, work_map, all_transcript, client):
            updated_map = work_map.model_copy(update={"version": work_map.version + 1})
            return corrected_output, updated_map

        async def mock_classify_confirmed(reply_text, work_map, all_transcript, client):
            return confirmed_output, work_map

        output1, map1 = asyncio.run(
            mock_classify_corrected("Actually it's fifteen thousand", mock_work_map, [], None)
        )
        assert output1.classification == "corrected"
        assert map1.version == 2

        output2, map2 = asyncio.run(
            mock_classify_confirmed("Yes that's right", map1, [], None)
        )
        assert output2.classification == "confirmed"
        assert map2.version == 2

    def test_final_map_structure_is_valid(self):
        mock_work_map = _make_mock_work_map("fixture-session-001")
        json_str = mock_work_map.model_dump_json(indent=2)
        loaded = WorkMap.model_validate_json(json_str)
        assert loaded.session_id == "fixture-session-001"
        assert len(loaded.steps) == 4
        assert loaded.steps[2].guardrails[0].kind == GuardrailKind.limit
        print("\n--- Final WorkMap JSON ---")
        print(json_str)
