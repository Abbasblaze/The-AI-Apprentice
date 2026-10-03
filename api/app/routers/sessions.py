from fastapi import APIRouter, Request

from app.repositories.sessions import SessionRepository
from app.schemas import SessionEventsResponse

router = APIRouter()


@router.get("/sessions/{session_id}/events", response_model=SessionEventsResponse)
async def get_events(request: Request, session_id: str) -> SessionEventsResponse:
    repo: SessionRepository = request.app.state.session_repo
    events = repo.get_events(session_id)
    return SessionEventsResponse(session_id=session_id, events=events)


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
