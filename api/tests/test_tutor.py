from __future__ import annotations

import asyncio
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.schemas import (
    CheckVerdict,
    Guardrail,
    GuardrailKind,
    PredictionResult,
    ScreenMoment,
    Step,
    StepReason,
    TutorIntervention,
    TutorPrediction,
    TutorSession,
    WorkMap,
)
from app.services.tutor_service import (
    InvoiceStateIn,
    _numeric_verdict,
    compute_mastery,
    judge_action,
)


def _make_guardrail(
    gid: str = "g-001",
    threshold: float | None = 5000.0,
    comparator: str | None = "gt",
    threshold_field: str | None = "amount",
    blocked_value: str | None = "opex 4711",
) -> Guardrail:
    return Guardrail(
        id=gid,
        kind=GuardrailKind.limit,
        rule="Equipment invoices over EUR 5,000 must be coded to capex 0400, not opex 4711",
        quote="Anything above five thousand euros that is physical equipment goes to capex, never opex",
        quote_t=68.0,
        threshold=threshold,
        comparator=comparator,
        threshold_field=threshold_field,
        blocked_value=blocked_value,
    )


def _make_step(step_id: str = "s-001", guardrails: list[Guardrail] | None = None) -> Step:
    return Step(
        id=step_id,
        order=1,
        title="Code cost center",
        screen_moment=ScreenMoment(t=45.0, snapshot_t=20.0, subject="invoice"),
        decision="Assign capex 0400 for equipment over EUR 5,000",
        reason=StepReason(
            text="Physical equipment over EUR 5,000 must be capitalised",
            quote="Anything above five thousand euros goes to capex",
            quote_t=68.0,
            unconfirmed=False,
        ),
        is_judgment_call=False,
        guardrails=guardrails or [],
        confidence=0.95,
    )


def _make_work_map(steps: list[Step] | None = None) -> WorkMap:
    return WorkMap(
        session_id="test-session-001",
        process_name="Equipment invoice coding",
        summary="Test map",
        steps=steps or [],
        expert_confirmed=False,
        demo_ready=True,
    )


def _make_invoice(amount: float = 8150.0, cost_center: str = "opex 4711") -> InvoiceStateIn:
    return InvoiceStateIn(
        supplier="Hartmann GmbH",
        country="Germany",
        amount=amount,
        cost_center=cost_center,
        asset_number="",
        status="open",
        internal_note="",
    )


def _make_tutor_session(work_map_session_id: str = "test-session-001") -> TutorSession:
    return TutorSession(
        id="tutor-001",
        work_map_session_id=work_map_session_id,
        started_at=time.time(),
    )


class TestNumericVerdictRule:
    def test_blocks_when_threshold_met_and_blocked_value_matches(self):
        guardrail = _make_guardrail()
        invoice = _make_invoice(amount=8150.0, cost_center="opex 4711")
        result = _numeric_verdict(guardrail, invoice, "change_cost_center", "opex 4711")
        assert result == "block"

    def test_allows_when_threshold_met_but_correct_value(self):
        guardrail = _make_guardrail()
        invoice = _make_invoice(amount=8150.0)
        result = _numeric_verdict(guardrail, invoice, "change_cost_center", "capex 0400")
        assert result is None

    def test_allows_when_below_threshold(self):
        guardrail = _make_guardrail()
        invoice = _make_invoice(amount=3000.0)
        result = _numeric_verdict(guardrail, invoice, "change_cost_center", "opex 4711")
        assert result is None

    def test_returns_none_when_threshold_missing(self):
        guardrail = _make_guardrail(threshold=None)
        invoice = _make_invoice(amount=8150.0)
        result = _numeric_verdict(guardrail, invoice, "change_cost_center", "opex 4711")
        assert result is None

    def test_blocks_post_when_cost_center_is_wrong_and_over_threshold(self):
        guardrail = _make_guardrail()
        invoice = _make_invoice(amount=8150.0, cost_center="opex 4711")
        result = _numeric_verdict(guardrail, invoice, "post", None)
        assert result == "block"

    def test_allows_post_when_cost_center_correct(self):
        guardrail = _make_guardrail()
        invoice = _make_invoice(amount=8150.0, cost_center="capex 0400")
        result = _numeric_verdict(guardrail, invoice, "post", None)
        assert result is None


class TestVerdictEnforcement:
    def test_numeric_block_does_not_require_model(self):
        guardrail = _make_guardrail()
        step = _make_step(guardrails=[guardrail])
        work_map = _make_work_map(steps=[step])
        invoice = _make_invoice(amount=8150.0, cost_center="opex 4711")

        verdict = asyncio.run(
            judge_action(
                tutor_session_id="tutor-001",
                action_type="change_cost_center",
                action_value="opex 4711",
                invoice=invoice,
                work_map=work_map,
                client=MagicMock(),
            )
        )
        assert verdict.verdict == "block"
        assert verdict.guardrail_id == "g-001"

    def test_invalid_guardrail_id_downgraded_to_allow(self):
        mock_output = MagicMock()
        mock_output.verdict = "block"
        mock_output.guardrail_id = "nonexistent-guardrail"
        mock_output.step_id = None
        mock_output.asks_why = "Why?"

        mock_response = MagicMock()
        mock_response.output_parsed = mock_output

        mock_client = MagicMock()
        mock_client.responses.parse = AsyncMock(return_value=mock_response)

        guardrail = _make_guardrail(threshold=None)
        step = _make_step(guardrails=[guardrail])
        work_map = _make_work_map(steps=[step])
        invoice = _make_invoice(amount=100.0)

        import app.services.tutor_service as svc
        svc._verdict_cache.clear()

        verdict = asyncio.run(
            judge_action(
                tutor_session_id="tutor-enforce-001",
                action_type="change_cost_center",
                action_value="opex 4711",
                invoice=invoice,
                work_map=work_map,
                client=mock_client,
            )
        )
        assert verdict.verdict == "allow"


class TestTimeoutFallback:
    def test_timeout_returns_allow_with_flag(self):
        mock_client = MagicMock()
        mock_client.responses.parse = AsyncMock(side_effect=asyncio.TimeoutError())

        guardrail = _make_guardrail(threshold=None)
        step = _make_step(guardrails=[guardrail])
        work_map = _make_work_map(steps=[step])
        invoice = _make_invoice(amount=100.0)

        import app.services.tutor_service as svc
        svc._verdict_cache.clear()

        with patch("asyncio.wait_for", side_effect=asyncio.TimeoutError()):
            verdict = asyncio.run(
                judge_action(
                    tutor_session_id="tutor-timeout-001",
                    action_type="change_cost_center",
                    action_value="opex 4711",
                    invoice=invoice,
                    work_map=work_map,
                    client=mock_client,
                )
            )
        assert verdict.verdict == "allow"
        assert verdict.timeout is True


class TestCacheHit:
    def test_second_call_returns_from_cache(self):
        mock_output = MagicMock()
        mock_output.verdict = "allow"
        mock_output.guardrail_id = None
        mock_output.step_id = None
        mock_output.asks_why = ""

        mock_response = MagicMock()
        mock_response.output_parsed = mock_output

        mock_client = MagicMock()
        mock_client.responses.parse = AsyncMock(return_value=mock_response)

        guardrail = _make_guardrail(threshold=None)
        step = _make_step(guardrails=[guardrail])
        work_map = _make_work_map(steps=[step])
        invoice = _make_invoice(amount=100.0)

        import app.services.tutor_service as svc
        svc._verdict_cache.clear()

        v1 = asyncio.run(
            judge_action(
                tutor_session_id="tutor-cache-001",
                action_type="set_asset_number",
                action_value="A-999",
                invoice=invoice,
                work_map=work_map,
                client=mock_client,
            )
        )
        v2 = asyncio.run(
            judge_action(
                tutor_session_id="tutor-cache-001",
                action_type="set_asset_number",
                action_value="A-999",
                invoice=invoice,
                work_map=work_map,
                client=mock_client,
            )
        )
        assert mock_client.responses.parse.call_count == 1
        assert v2.from_cache is True


class TestMasteryCalculation:
    def test_step_with_correct_prediction_is_mastered(self):
        step = _make_step(step_id="s-mastered")
        work_map = _make_work_map(steps=[step])
        session = _make_tutor_session()
        session.predictions.append(
            TutorPrediction(
                id="p-001",
                step_id="s-mastered",
                question="What would you do next?",
                answer="Set capex 0400",
                result=PredictionResult.correct,
                t=time.time(),
            )
        )

        mastery = compute_mastery(session, work_map)
        assert "Code cost center" in mastery.mastered_steps
        assert mastery.practice_next == []

    def test_step_with_blocks_is_not_mastered(self):
        step = _make_step(step_id="s-blocked")
        work_map = _make_work_map(steps=[step])
        session = _make_tutor_session()

        verdict = CheckVerdict(
            verdict="block",
            guardrail_id="g-001",
            step_id="s-blocked",
            explanation="Rule violated",
            asks_why="Why?",
        )
        session.interventions.append(
            TutorIntervention(
                id="i-001",
                step_id="s-blocked",
                guardrail_id="g-001",
                verdict=verdict,
                t=time.time(),
            )
        )
        session.interventions.append(
            TutorIntervention(
                id="i-002",
                step_id="s-blocked",
                guardrail_id="g-001",
                verdict=verdict,
                t=time.time(),
            )
        )

        mastery = compute_mastery(session, work_map)
        assert "Code cost center" in mastery.practice_next
        assert mastery.mastered_steps == []
