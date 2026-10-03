import time
from abc import ABC, abstractmethod
from collections import defaultdict
from pathlib import Path
from typing import Optional

from app.schemas import (
    AppEvent,
    SessionData,
    SessionRecord,
    SessionSummary,
    SnapshotIndex,
    StoredDecision,
    TranscriptEntry,
)


class SessionRepository(ABC):
    @abstractmethod
    def add_events(self, session_id: str, events: list[AppEvent]) -> None: ...

    @abstractmethod
    def get_events(self, session_id: str) -> list[AppEvent]: ...

    @abstractmethod
    def add_erp_events(self, session_id: str, events: list[AppEvent]) -> None: ...

    @abstractmethod
    def get_erp_events(self, session_id: str) -> list[AppEvent]: ...

    @abstractmethod
    def add_transcript_entries(self, session_id: str, entries: list[TranscriptEntry]) -> None: ...

    @abstractmethod
    def get_transcript(self, session_id: str) -> list[TranscriptEntry]: ...

    @abstractmethod
    def add_director_decision(self, session_id: str, decision: StoredDecision) -> None: ...

    @abstractmethod
    def get_director_decisions(self, session_id: str) -> list[StoredDecision]: ...

    @abstractmethod
    def add_snapshot(self, session_id: str, entry: SnapshotIndex) -> None: ...

    @abstractmethod
    def get_snapshots(self, session_id: str) -> list[SnapshotIndex]: ...

    @abstractmethod
    def end_session(self, session_id: str, end_time: float) -> None: ...

    @abstractmethod
    def list_sessions(self) -> list[SessionSummary]: ...

    @abstractmethod
    def get_session_record(self, session_id: str) -> Optional[SessionRecord]: ...


class InMemorySessionRepository(SessionRepository):
    def __init__(self) -> None:
        self._events: dict[str, list[AppEvent]] = defaultdict(list)
        self._erp_events: dict[str, list[AppEvent]] = defaultdict(list)
        self._transcript: dict[str, list[TranscriptEntry]] = defaultdict(list)
        self._decisions: dict[str, list[StoredDecision]] = defaultdict(list)
        self._snapshots: dict[str, list[SnapshotIndex]] = defaultdict(list)
        self._start_times: dict[str, float] = {}
        self._end_times: dict[str, float] = {}

    def _ensure_start(self, session_id: str) -> None:
        if session_id not in self._start_times:
            self._start_times[session_id] = time.time()

    def add_events(self, session_id: str, events: list[AppEvent]) -> None:
        self._ensure_start(session_id)
        self._events[session_id].extend(events)

    def get_events(self, session_id: str) -> list[AppEvent]:
        return list(self._events[session_id])

    def add_erp_events(self, session_id: str, events: list[AppEvent]) -> None:
        self._ensure_start(session_id)
        self._erp_events[session_id].extend(events)

    def get_erp_events(self, session_id: str) -> list[AppEvent]:
        return list(self._erp_events[session_id])

    def add_transcript_entries(self, session_id: str, entries: list[TranscriptEntry]) -> None:
        self._transcript[session_id].extend(entries)

    def get_transcript(self, session_id: str) -> list[TranscriptEntry]:
        return list(self._transcript[session_id])

    def add_director_decision(self, session_id: str, decision: StoredDecision) -> None:
        self._decisions[session_id].append(decision)

    def get_director_decisions(self, session_id: str) -> list[StoredDecision]:
        return list(self._decisions[session_id])

    def add_snapshot(self, session_id: str, entry: SnapshotIndex) -> None:
        self._snapshots[session_id].append(entry)

    def get_snapshots(self, session_id: str) -> list[SnapshotIndex]:
        return list(self._snapshots[session_id])

    def end_session(self, session_id: str, end_time: float) -> None:
        self._end_times[session_id] = end_time

    def list_sessions(self) -> list[SessionSummary]:
        all_ids = set(self._start_times) | set(self._events) | set(self._erp_events)
        summaries = []
        for sid in all_ids:
            summaries.append(
                SessionSummary(
                    session_id=sid,
                    start_time=self._start_times.get(sid, 0.0),
                    end_time=self._end_times.get(sid),
                    event_count=len(self._events[sid]),
                    erp_event_count=len(self._erp_events[sid]),
                    question_count=sum(
                        1 for d in self._decisions[sid] if d.should_ask
                    ),
                )
            )
        return sorted(summaries, key=lambda s: s.start_time, reverse=True)

    def get_session_record(self, session_id: str) -> Optional[SessionRecord]:
        if session_id not in self._start_times and not self._events[session_id]:
            return None
        return SessionRecord(
            session_id=session_id,
            start_time=self._start_times.get(session_id, 0.0),
            end_time=self._end_times.get(session_id),
            events=self.get_events(session_id),
            erp_events=self.get_erp_events(session_id),
            transcript=self.get_transcript(session_id),
            decisions=self.get_director_decisions(session_id),
            snapshots=self.get_snapshots(session_id),
        )


class FileSessionRepository(SessionRepository):
    def __init__(self, base_dir: Path) -> None:
        self.base_dir = base_dir
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _session_path(self, session_id: str) -> Path:
        return self.base_dir / session_id / "session.json"

    def _load(self, session_id: str) -> SessionData:
        path = self._session_path(session_id)
        if path.exists():
            return SessionData.model_validate_json(path.read_text())
        return SessionData(session_id=session_id)

    def _save(self, session_id: str, data: SessionData) -> None:
        path = self._session_path(session_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(data.model_dump_json(indent=2))

    def add_events(self, session_id: str, events: list[AppEvent]) -> None:
        data = self._load(session_id)
        data.events.extend(events)
        self._save(session_id, data)

    def get_events(self, session_id: str) -> list[AppEvent]:
        return self._load(session_id).events

    def add_erp_events(self, session_id: str, events: list[AppEvent]) -> None:
        data = self._load(session_id)
        data.erp_events.extend(events)
        self._save(session_id, data)

    def get_erp_events(self, session_id: str) -> list[AppEvent]:
        return self._load(session_id).erp_events

    def add_transcript_entries(self, session_id: str, entries: list[TranscriptEntry]) -> None:
        data = self._load(session_id)
        data.transcript.extend(entries)
        self._save(session_id, data)

    def get_transcript(self, session_id: str) -> list[TranscriptEntry]:
        return self._load(session_id).transcript

    def add_director_decision(self, session_id: str, decision: StoredDecision) -> None:
        data = self._load(session_id)
        data.decisions.append(decision)
        self._save(session_id, data)

    def get_director_decisions(self, session_id: str) -> list[StoredDecision]:
        return self._load(session_id).decisions

    def add_snapshot(self, session_id: str, entry: SnapshotIndex) -> None:
        data = self._load(session_id)
        data.snapshots.append(entry)
        self._save(session_id, data)

    def get_snapshots(self, session_id: str) -> list[SnapshotIndex]:
        return self._load(session_id).snapshots

    def end_session(self, session_id: str, end_time: float) -> None:
        data = self._load(session_id)
        data.end_time = end_time
        self._save(session_id, data)

    def list_sessions(self) -> list[SessionSummary]:
        summaries = []
        if not self.base_dir.exists():
            return summaries
        for session_dir in self.base_dir.iterdir():
            if not session_dir.is_dir():
                continue
            session_path = session_dir / "session.json"
            if not session_path.exists():
                continue
            try:
                data = SessionData.model_validate_json(session_path.read_text())
                summaries.append(
                    SessionSummary(
                        session_id=data.session_id,
                        start_time=data.start_time,
                        end_time=data.end_time,
                        event_count=len(data.events),
                        erp_event_count=len(data.erp_events),
                        question_count=sum(1 for d in data.decisions if d.should_ask),
                    )
                )
            except Exception:
                continue
        return sorted(summaries, key=lambda s: s.start_time, reverse=True)

    def get_session_record(self, session_id: str) -> Optional[SessionRecord]:
        path = self._session_path(session_id)
        if not path.exists():
            return None
        data = SessionData.model_validate_json(path.read_text())
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
