from pathlib import Path

from app.schemas import SessionData


def load_fixture() -> SessionData:
    path = Path(__file__).parent / "session.json"
    return SessionData.model_validate_json(path.read_text())
