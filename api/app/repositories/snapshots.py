import base64
from abc import ABC, abstractmethod
from pathlib import Path


class SnapshotStore(ABC):
    @abstractmethod
    def save(self, session_id: str, t: float, image_b64: str) -> bool:
        """Save a JPEG snapshot. Returns True if saved, False if already exists."""
        ...

    @abstractmethod
    def path(self, session_id: str, t: float) -> Path | None:
        """Return the path to a snapshot, or None if not found."""
        ...


class FileSnapshotStore(SnapshotStore):
    def __init__(self, base_dir: Path) -> None:
        self.base_dir = base_dir

    def _snapshot_path(self, session_id: str, t: float) -> Path:
        return self.base_dir / session_id / "snapshots" / f"{t:.3f}.jpg"

    def save(self, session_id: str, t: float, image_b64: str) -> bool:
        dest = self._snapshot_path(session_id, t)
        if dest.exists():
            return False
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(base64.b64decode(image_b64))
        return True

    def path(self, session_id: str, t: float) -> Path | None:
        p = self._snapshot_path(session_id, t)
        return p if p.exists() else None
