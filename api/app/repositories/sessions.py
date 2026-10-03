from abc import ABC, abstractmethod
from collections import defaultdict

from app.schemas import AppEvent, StoredDecision, TranscriptEntry


class SessionRepository(ABC):
    @abstractmethod
    def add_events(self, session_id: str, events: list[AppEvent]) -> None: ...

    @abstractmethod
    def get_events(self, session_id: str) -> list[AppEvent]: ...

    @abstractmethod
    def add_transcript_entries(self, session_id: str, entries: list[TranscriptEntry]) -> None: ...

    @abstractmethod
    def get_transcript(self, session_id: str) -> list[TranscriptEntry]: ...

    @abstractmethod
    def add_director_decision(self, session_id: str, decision: StoredDecision) -> None: ...

    @abstractmethod
    def get_director_decisions(self, session_id: str) -> list[StoredDecision]: ...


class InMemorySessionRepository(SessionRepository):
    def __init__(self) -> None:
        self._events: dict[str, list[AppEvent]] = defaultdict(list)
        self._transcript: dict[str, list[TranscriptEntry]] = defaultdict(list)
        self._decisions: dict[str, list[StoredDecision]] = defaultdict(list)

    def add_events(self, session_id: str, events: list[AppEvent]) -> None:
        self._events[session_id].extend(events)

    def get_events(self, session_id: str) -> list[AppEvent]:
        return list(self._events[session_id])

    def add_transcript_entries(self, session_id: str, entries: list[TranscriptEntry]) -> None:
        self._transcript[session_id].extend(entries)

    def get_transcript(self, session_id: str) -> list[TranscriptEntry]:
        return list(self._transcript[session_id])

    def add_director_decision(self, session_id: str, decision: StoredDecision) -> None:
        self._decisions[session_id].append(decision)

    def get_director_decisions(self, session_id: str) -> list[StoredDecision]:
        return list(self._decisions[session_id])
