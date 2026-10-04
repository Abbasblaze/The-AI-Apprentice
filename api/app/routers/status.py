from __future__ import annotations

from fastapi import APIRouter, Request

from app.config import config
from app.repositories.sessions import SessionRepository
from app.services.image_redactor import check_tesseract_or_raise

router = APIRouter()


@router.get("/status")
async def get_status(request: Request) -> dict:
    repo: SessionRepository = request.app.state.session_repo

    tesseract_ok = True
    try:
        check_tesseract_or_raise()
    except RuntimeError:
        tesseract_ok = False

    sessions = repo.list_sessions()
    has_confirmed_map = False
    confirmed_map_session_id: str | None = None
    for s in sessions:
        if s.has_map:
            m = repo.load_map(s.session_id)
            if m and m.expert_confirmed:
                has_confirmed_map = True
                confirmed_map_session_id = s.session_id
                break

    return {
        "api": "ok",
        "models": {
            "vision": config.vision_model,
            "director": config.director_model,
            "map": config.map_model,
            "tutor": config.tutor_model,
        },
        "agents": {
            "interview": bool(config.elevenlabs_agent_id),
            "debrief": bool(config.elevenlabs_debrief_agent_id),
            "tutor": bool(config.elevenlabs_tutor_agent_id),
        },
        "tesseract": tesseract_ok,
        "confirmed_map": has_confirmed_map,
        "confirmed_map_session_id": confirmed_map_session_id,
    }
