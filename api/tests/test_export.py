from __future__ import annotations

import json

import pytest

from app.schemas import (
    DebriefPhase,
    DebriefState,
    Gap,
    GapKind,
    GapPriority,
)
from app.services.export_service import build_json, build_markdown
from tests.fixtures import load_confirmed_map, load_demo_map


class TestExportRequiresConfirmedMap:
    def test_unconfirmed_map_not_exported(self):
        demo_map = load_demo_map()
        assert demo_map.expert_confirmed is False

    def test_confirmed_map_flag_is_true(self):
        confirmed = load_confirmed_map()
        assert confirmed.expert_confirmed is True
        assert confirmed.confirmed_at is not None


class TestMarkdownExport:
    def setup_method(self):
        self.work_map = load_confirmed_map()

    def test_contains_process_name(self):
        md = build_markdown(self.work_map, None)
        assert "Equipment invoice coding" in md

    def test_contains_confirmed_header(self):
        md = build_markdown(self.work_map, None)
        assert "Confirmed by the expert" in md

    def test_contains_goal_section(self):
        md = build_markdown(self.work_map, None)
        assert "## Goal" in md
        assert self.work_map.summary in md

    def test_contains_all_steps(self):
        md = build_markdown(self.work_map, None)
        for step in self.work_map.steps:
            assert step.title in md
            assert step.decision in md

    def test_step_includes_when_what_why(self):
        md = build_markdown(self.work_map, None)
        assert "**When:**" in md
        assert "**What:**" in md
        assert "**Why:**" in md

    def test_step_includes_expert_quote(self):
        md = build_markdown(self.work_map, None)
        assert "Anything above five thousand euros" in md
        assert "**Expert said:**" in md

    def test_hard_stops_section_present(self):
        md = build_markdown(self.work_map, None)
        assert "## Hard stops" in md

    def test_every_guardrail_in_hard_stops(self):
        md = build_markdown(self.work_map, None)
        for step in self.work_map.steps:
            for g in step.guardrails:
                assert g.rule in md
                assert g.quote in md

    def test_guardrail_includes_who_to_ask(self):
        md = build_markdown(self.work_map, None)
        assert "Finance controller" in md

    def test_stop_and_ask_section_present(self):
        md = build_markdown(self.work_map, None)
        assert "## Stop and ask a person" in md

    def test_not_covered_section_present(self):
        md = build_markdown(self.work_map, None)
        assert "## Not covered" in md

    def test_not_covered_uses_open_gaps(self):
        gap = Gap(
            id="test-gap-1",
            kind=GapKind.scope,
            question="Does this apply to services as well?",
            priority=GapPriority.normal,
            closed=False,
        )
        state = DebriefState(
            phase=DebriefPhase.confirmed,
            gaps=[gap],
            gaps_answered=3,
        )
        md = build_markdown(self.work_map, state)
        assert "Does this apply to services as well?" in md
        assert "scope not confirmed" in md

    def test_not_covered_falls_back_to_defaults_when_no_gaps(self):
        state = DebriefState(
            phase=DebriefPhase.confirmed,
            gaps=[],
            gaps_answered=3,
        )
        md = build_markdown(self.work_map, state)
        assert "When does this process NOT apply?" in md

    def test_closed_gaps_excluded_from_not_covered(self):
        gap_open = Gap(
            id="gap-open",
            kind=GapKind.scope,
            question="Open gap question",
            priority=GapPriority.normal,
            closed=False,
        )
        gap_closed = Gap(
            id="gap-closed",
            kind=GapKind.authority,
            question="Closed gap question",
            priority=GapPriority.normal,
            closed=True,
        )
        state = DebriefState(
            phase=DebriefPhase.confirmed,
            gaps=[gap_open, gap_closed],
            gaps_answered=3,
        )
        md = build_markdown(self.work_map, state)
        assert "Open gap question" in md
        assert "Closed gap question" not in md


class TestJsonExport:
    def setup_method(self):
        self.work_map = load_confirmed_map()

    def test_returns_dict(self):
        result = build_json(self.work_map, None)
        assert isinstance(result, dict)

    def test_has_all_top_level_keys(self):
        result = build_json(self.work_map, None)
        assert "export_version" in result
        assert "process_name" in result
        assert "confirmed_by" in result
        assert "confirmed_at" in result
        assert "goal" in result
        assert "steps" in result
        assert "hard_stops" in result
        assert "stop_and_ask" in result
        assert "not_covered" in result

    def test_confirmed_by_is_expert(self):
        result = build_json(self.work_map, None)
        assert result["confirmed_by"] == "the expert"

    def test_confirmed_at_is_formatted(self):
        result = build_json(self.work_map, None)
        assert result["confirmed_at"] is not None
        assert "UTC" in result["confirmed_at"]

    def test_steps_have_stable_ids(self):
        result = build_json(self.work_map, None)
        ids = [s["id"] for s in result["steps"]]
        assert "conf-step-001" in ids
        assert "conf-step-002" in ids
        assert "conf-step-003" in ids

    def test_every_step_has_when_what_why(self):
        result = build_json(self.work_map, None)
        for step in result["steps"]:
            assert "when" in step
            assert "what" in step
            assert "why" in step

    def test_every_guardrail_in_hard_stops(self):
        result = build_json(self.work_map, None)
        guardrail_ids = {h["id"] for h in result["hard_stops"]}
        assert "conf-grail-001" in guardrail_ids

    def test_hard_stop_has_expert_quote(self):
        result = build_json(self.work_map, None)
        grail = next(h for h in result["hard_stops"] if h["id"] == "conf-grail-001")
        assert "Anything above five thousand euros" in grail["expert_quote"]

    def test_not_covered_has_entries(self):
        result = build_json(self.work_map, None)
        assert len(result["not_covered"]) > 0

    def test_not_covered_uses_open_gaps(self):
        gap = Gap(
            id="test-gap-json",
            kind=GapKind.never_do,
            question="What must never be done?",
            priority=GapPriority.high,
            closed=False,
        )
        state = DebriefState(
            phase=DebriefPhase.confirmed,
            gaps=[gap],
            gaps_answered=3,
        )
        result = build_json(self.work_map, state)
        questions = [n["question"] for n in result["not_covered"]]
        assert "What must never be done?" in questions

    def test_json_and_markdown_agree_on_process_name(self):
        md = build_markdown(self.work_map, None)
        data = build_json(self.work_map, None)
        assert data["process_name"] in md

    def test_json_and_markdown_agree_on_guardrail_count(self):
        all_guardrails_md = build_markdown(self.work_map, None).count("**Kind:**")
        all_guardrails_json = len(build_json(self.work_map, None)["hard_stops"])
        assert all_guardrails_md == all_guardrails_json

    def test_serialisable_to_json_string(self):
        result = build_json(self.work_map, None)
        serialised = json.dumps(result)
        assert len(serialised) > 100
