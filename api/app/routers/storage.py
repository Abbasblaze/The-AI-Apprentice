from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

_DATA_ROOT = Path("api/data")
_SESSIONS_DIR = _DATA_ROOT / "sessions"
_TUTOR_DIR = _DATA_ROOT / "tutor"


class StorageInfo(BaseModel):
    data_dir: str
    session_count: int
    tutor_session_count: int
    total_size_bytes: int
    gitignored: bool


def _count_dirs(path: Path) -> int:
    if not path.exists():
        return 0
    return sum(1 for p in path.iterdir() if p.is_dir())


def _dir_size(path: Path) -> int:
    if not path.exists():
        return 0
    return sum(f.stat().st_size for f in path.rglob("*") if f.is_file())


@router.get("/storage", response_model=StorageInfo)
async def get_storage() -> StorageInfo:
    gitignore = Path(".gitignore")
    gitignored = False
    if gitignore.exists():
        text = gitignore.read_text()
        gitignored = "api/data/" in text

    return StorageInfo(
        data_dir=str(_DATA_ROOT.resolve()),
        session_count=_count_dirs(_SESSIONS_DIR),
        tutor_session_count=_count_dirs(_TUTOR_DIR),
        total_size_bytes=_dir_size(_DATA_ROOT),
        gitignored=gitignored,
    )
