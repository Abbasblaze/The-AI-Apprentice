from pathlib import Path

import pytest

from app.repositories.sessions import FileSessionRepository
from app.schemas import AppEvent, EventKind, EventSource, SnapshotIndex, StoredDecision, TranscriptEntry, TranscriptRole


def make_event(idx: int = 0) -> AppEvent:
    return AppEvent(
        id=f"evt-{idx}",
        t=float(idx),
        kind=EventKind.changed,
        subject="invoice INV-4471",
        field="cost center",
        from_value="opex 4711",
        to_value="capex 0400",
        summary="Cost center changed",
        source=EventSource.vision,
    )


def make_erp_event(idx: int = 0) -> AppEvent:
    return AppEvent(
        id=f"erp-{idx}",
        t=float(idx),
        kind=EventKind.changed,
        subject="invoice INV-4471",
        field="cost center",
        from_value="opex 4711",
        to_value="capex 0400",
        summary="Cost center changed (ERP)",
        source=EventSource.erp,
    )


@pytest.fixture
def repo(tmp_path: Path) -> FileSessionRepository:
    return FileSessionRepository(tmp_path)


def test_add_and_get_events(repo: FileSessionRepository) -> None:
    evt = make_event()
    repo.add_events("s1", [evt])
    result = repo.get_events("s1")
    assert len(result) == 1
    assert result[0].id == "evt-0"


def test_events_persist_across_load(tmp_path: Path) -> None:
    repo1 = FileSessionRepository(tmp_path)
    repo1.add_events("s1", [make_event(0)])
    repo1.add_events("s1", [make_event(1)])

    repo2 = FileSessionRepository(tmp_path)
    events = repo2.get_events("s1")
    assert len(events) == 2


def test_add_and_get_erp_events(repo: FileSessionRepository) -> None:
    erp = make_erp_event()
    repo.add_erp_events("s1", [erp])
    result = repo.get_erp_events("s1")
    assert len(result) == 1
    assert result[0].source == EventSource.erp


def test_add_snapshot(repo: FileSessionRepository) -> None:
    repo.add_snapshot("s1", SnapshotIndex(t=5.0, filename="5.000.jpg"))
    snaps = repo.get_snapshots("s1")
    assert len(snaps) == 1
    assert snaps[0].filename == "5.000.jpg"


def test_end_session(repo: FileSessionRepository) -> None:
    repo.add_events("s1", [make_event()])
    repo.end_session("s1", 1234567890.0)
    record = repo.get_session_record("s1")
    assert record is not None
    assert record.end_time == 1234567890.0


def test_list_sessions(repo: FileSessionRepository) -> None:
    repo.add_events("s1", [make_event(0)])
    repo.add_events("s2", [make_event(1), make_event(2)])
    sessions = repo.list_sessions()
    ids = {s.session_id for s in sessions}
    assert ids == {"s1", "s2"}
    s2 = next(s for s in sessions if s.session_id == "s2")
    assert s2.event_count == 2


def test_get_session_record_missing_returns_none(repo: FileSessionRepository) -> None:
    assert repo.get_session_record("nonexistent") is None


def test_erp_event_count_in_summary(repo: FileSessionRepository) -> None:
    repo.add_erp_events("s1", [make_erp_event(0), make_erp_event(1)])
    summaries = repo.list_sessions()
    assert summaries[0].erp_event_count == 2
