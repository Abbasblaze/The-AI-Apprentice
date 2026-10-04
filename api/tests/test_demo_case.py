from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock

from app.schemas import CheckVerdict
from app.services.tutor_service import InvoiceStateIn, _numeric_verdict, judge_action
from tests.fixtures import load_demo_map


class TestDemoCase:
    def test_block_opex_on_equipment_over_5000(self):
        demo_map = load_demo_map()
        invoice = InvoiceStateIn(
            supplier="Hartmann Präzisionsteile GmbH",
            country="Germany",
            amount=8150.0,
            cost_center="opex 4711",
            asset_number="",
            status="open",
            internal_note="",
        )

        step = demo_map.steps[1]
        guardrail = step.guardrails[0]
        result = _numeric_verdict(guardrail, invoice, "change_cost_center", "opex 4711")

        assert result == "block"
        assert guardrail.threshold == 5000.0
        assert guardrail.comparator == "gt"
        assert guardrail.threshold_field == "amount"
        assert guardrail.blocked_value == "opex 4711"

        verdict = asyncio.run(
            judge_action(
                tutor_session_id="demo-test-001",
                action_type="change_cost_center",
                action_value="opex 4711",
                invoice=invoice,
                work_map=demo_map,
                client=MagicMock(),
            )
        )

        assert verdict.verdict == "block"
        assert verdict.guardrail_id == "demo-grail-001"
        assert "Equipment invoices over EUR 5,000" in verdict.explanation

    def test_allow_capex_on_equipment(self):
        demo_map = load_demo_map()
        invoice = InvoiceStateIn(
            supplier="Hartmann Präzisionsteile GmbH",
            country="Germany",
            amount=8150.0,
            cost_center="opex 4711",
            asset_number="",
            status="open",
            internal_note="",
        )

        step = demo_map.steps[1]
        guardrail = step.guardrails[0]
        result = _numeric_verdict(guardrail, invoice, "change_cost_center", "capex 0400")

        assert result is None

        mock_output = MagicMock()
        mock_output.verdict = "allow"
        mock_output.guardrail_id = None
        mock_output.step_id = None
        mock_output.asks_why = ""

        mock_response = MagicMock()
        mock_response.output_parsed = mock_output

        mock_client = MagicMock()
        mock_client.responses.parse = AsyncMock(return_value=mock_response)

        import app.services.tutor_service as svc
        svc._verdict_cache.clear()

        verdict = asyncio.run(
            judge_action(
                tutor_session_id="demo-test-002",
                action_type="change_cost_center",
                action_value="capex 0400",
                invoice=invoice,
                work_map=demo_map,
                client=mock_client,
            )
        )

        assert verdict.verdict == "allow"
