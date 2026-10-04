from pathlib import Path

from app.schemas import SessionData, WorkMap


def load_fixture() -> SessionData:
    path = Path(__file__).parent / "session.json"
    return SessionData.model_validate_json(path.read_text())


def load_demo_map() -> WorkMap:
    path = Path(__file__).parent / "demo_map.json"
    return WorkMap.model_validate_json(path.read_text())


def load_confirmed_map() -> WorkMap:
    path = Path(__file__).parent / "confirmed_map.json"
    return WorkMap.model_validate_json(path.read_text())
