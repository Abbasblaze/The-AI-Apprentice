from pathlib import Path
from typing import Optional

from app.schemas import TutorSession


class TutorRepository:
    def __init__(self, base_dir: Path) -> None:
        self.base_dir = base_dir
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _session_path(self, session_id: str) -> Path:
        return self.base_dir / session_id / "session.json"

    def save(self, session: TutorSession) -> None:
        path = self._session_path(session.id)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(session.model_dump_json(indent=2))

    def load(self, session_id: str) -> Optional[TutorSession]:
        path = self._session_path(session_id)
        if not path.exists():
            return None
        return TutorSession.model_validate_json(path.read_text())

    def list_sessions(self) -> list[TutorSession]:
        sessions: list[TutorSession] = []
        if not self.base_dir.exists():
            return sessions
        for session_dir in self.base_dir.iterdir():
            if not session_dir.is_dir():
                continue
            path = session_dir / "session.json"
            if not path.exists():
                continue
            try:
                sessions.append(TutorSession.model_validate_json(path.read_text()))
            except Exception:
                continue
        return sorted(sessions, key=lambda s: s.started_at, reverse=True)
