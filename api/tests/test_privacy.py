import time
from pathlib import Path

import pytest

from app.repositories.sessions import FileSessionRepository
from app.schemas import (
    AppEvent,
    EventKind,
    EventSource,
    MaskRegion,
    OffRecordPeriod,
    RedactionEntry,
    SnapshotIndex,
    StoredDecision,
    QuestionKind,
    TranscriptEntry,
    TranscriptRole,
)


@pytest.fixture
def repo(tmp_path: Path) -> FileSessionRepository:
    return FileSessionRepository(tmp_path)


def make_event(t: float) -> AppEvent:
    return AppEvent(
        id=f"evt-{t}",
        t=t,
        kind=EventKind.changed,
        subject="invoice",
        summary="changed something",
        source=EventSource.vision,
    )


def _snapshot_file(repo: FileSessionRepository, session_id: str, t: float) -> Path:
    path = repo._snapshots_dir(session_id) / f"{t:.3f}.jpg"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"fake jpeg bytes")
    return path


def test_off_record_period_saved_and_loaded(repo: FileSessionRepository) -> None:
    privacy = repo.load_privacy("s1")
    privacy.off_record_periods.append(OffRecordPeriod(start_t=10.0, end_t=20.0))
    repo.save_privacy("s1", privacy)

    loaded = repo.load_privacy("s1")
    assert len(loaded.off_record_periods) == 1
    assert loaded.off_record_periods[0].start_t == 10.0
    assert loaded.off_record_periods[0].end_t == 20.0


def test_forget_removes_events_in_window(repo: FileSessionRepository) -> None:
    repo.add_events("s1", [make_event(1.0)])
    data = repo._load("s1")
    data.start_time = time.time() - 10.0
    repo._save("s1", data)
    repo.add_events("s1", [make_event(time.time() - repo._load("s1").start_time)])

    record = repo.forget_last_qa("s1", window_seconds=120.0)
    assert record.events_removed >= 1


def test_forget_removes_snapshots_in_window(repo: FileSessionRepository) -> None:
    data = repo._load("s1")
    data.start_time = time.time() - 5.0
    data.snapshots = [SnapshotIndex(t=1.0, filename="1.000.jpg")]
    repo._save("s1", data)
    snap_path = _snapshot_file(repo, "s1", 1.0)

    record = repo.forget_last_qa("s1", window_seconds=120.0)
    assert record.snapshots_removed == 1
    assert not snap_path.exists()


def test_forget_records_counts(repo: FileSessionRepository) -> None:
    data = repo._load("s1")
    data.start_time = time.time() - 5.0
    data.events = [make_event(1.0), make_event(2.0)]
    data.snapshots = [SnapshotIndex(t=1.0, filename="1.000.jpg")]
    repo._save("s1", data)
    _snapshot_file(repo, "s1", 1.0)

    record = repo.forget_last_qa("s1", window_seconds=120.0)
    assert record.events_removed == 2
    assert record.snapshots_removed == 1

    privacy = repo.load_privacy("s1")
    assert len(privacy.forget_that_records) == 1


def test_privacy_summary_counts_aggregate(repo: FileSessionRepository) -> None:
    repo.append_redaction_log(
        "s1",
        [
            RedactionEntry(entity_type="IBAN", count=2, location="events"),
            RedactionEntry(entity_type="IBAN", count=1, location="transcript"),
            RedactionEntry(entity_type="EMAIL_ADDRESS", count=3, location="transcript"),
        ],
    )
    privacy = repo.load_privacy("s1")

    counts: dict[str, int] = {}
    by_location: dict[str, int] = {}
    for entry in privacy.redaction_log:
        counts[entry.entity_type] = counts.get(entry.entity_type, 0) + entry.count
        by_location[entry.location] = by_location.get(entry.location, 0) + entry.count

    assert counts["IBAN"] == 3
    assert counts["EMAIL_ADDRESS"] == 3
    assert by_location["transcript"] == 4
    assert by_location["events"] == 2


def test_delete_session_removes_all(repo: FileSessionRepository, tmp_path: Path) -> None:
    repo.add_events("s1", [make_event(1.0)])
    repo.save_privacy("s1", repo.load_privacy("s1"))
    assert (tmp_path / "s1").exists()

    repo.delete_session("s1")
    assert not (tmp_path / "s1").exists()
    assert repo.get_session_record("s1") is None


def test_mask_regions_saved_and_loaded(repo: FileSessionRepository) -> None:
    privacy = repo.load_privacy("s1")
    privacy.mask_regions = [MaskRegion(x=0.1, y=0.2, width=0.3, height=0.4)]
    repo.save_privacy("s1", privacy)

    loaded = repo.load_privacy("s1")
    assert len(loaded.mask_regions) == 1
    assert loaded.mask_regions[0].width == 0.3


def test_redaction_entries_accumulate(repo: FileSessionRepository) -> None:
    repo.append_redaction_log(
        "s1", [RedactionEntry(entity_type="IBAN", count=1, location="events")]
    )
    repo.append_redaction_log(
        "s1", [RedactionEntry(entity_type="PERSON", count=2, location="transcript")]
    )
    privacy = repo.load_privacy("s1")
    assert len(privacy.redaction_log) == 2


def test_forget_removes_answered_decision(repo: FileSessionRepository) -> None:
    data = repo._load("s1")
    data.start_time = time.time() - 5.0
    data.decisions = [
        StoredDecision(
            id="d1",
            t=1.0,
            should_ask=True,
            kind=QuestionKind.reason,
            anchor_event_id="e1",
            question="why?",
            why="context",
            answered=True,
            answer_text="because",
        )
    ]
    data.transcript = [
        TranscriptEntry(role=TranscriptRole.user, message="because", t=1.0)
    ]
    repo._save("s1", data)

    repo.forget_last_qa("s1", window_seconds=120.0)
    updated = repo._load("s1")
    assert len(updated.decisions) == 0
