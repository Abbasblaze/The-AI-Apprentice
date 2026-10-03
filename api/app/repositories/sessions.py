from abc import ABC, abstractmethod
from collections import defaultdict

from app.schemas import AppEvent


class SessionRepository(ABC):
    @abstractmethod
    def add_events(self, session_id: str, events: list[AppEvent]) -> None: ...

    @abstractmethod
    def get_events(self, session_id: str) -> list[AppEvent]: ...


class InMemorySessionRepository(SessionRepository):
    def __init__(self) -> None:
        self._store: dict[str, list[AppEvent]] = defaultdict(list)

    def add_events(self, session_id: str, events: list[AppEvent]) -> None:
        self._store[session_id].extend(events)

    def get_events(self, session_id: str) -> list[AppEvent]:
        return list(self._store[session_id])
