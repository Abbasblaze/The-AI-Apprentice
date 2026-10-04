import time

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse

from app.repositories.sessions import SessionRepository
from app.schemas import (
    EndSessionResponse,
    SessionEventsResponse,
    SessionListResponse,
    SessionRecord,
    WorkMap,
)

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/sessions", response_model=SessionListResponse)
async def list_sessions(request: Request) -> SessionListResponse:
    repo: SessionRepository = request.app.state.session_repo
    return SessionListResponse(sessions=repo.list_sessions())


@router.get("/sessions/{session_id}", response_model=SessionRecord)
async def get_session(request: Request, session_id: str) -> SessionRecord:
    repo: SessionRepository = request.app.state.session_repo
    record = repo.get_session_record(session_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return record


@router.get("/sessions/{session_id}/events", response_model=SessionEventsResponse)
async def get_events(request: Request, session_id: str) -> SessionEventsResponse:
    repo: SessionRepository = request.app.state.session_repo
    events = repo.get_events(session_id)
    return SessionEventsResponse(session_id=session_id, events=events)


@router.get("/sessions/{session_id}/snapshots/{t_str}")
async def get_snapshot(request: Request, session_id: str, t_str: str) -> FileResponse:
    base_dir = request.app.state.snapshot_base_dir
    path = base_dir / session_id / "snapshots" / f"{t_str}.jpg"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return FileResponse(str(path), media_type="image/jpeg")


@router.post("/sessions/{session_id}/end", response_model=EndSessionResponse)
async def end_session(request: Request, session_id: str) -> EndSessionResponse:
    repo: SessionRepository = request.app.state.session_repo
    repo.end_session(session_id, time.time())
    return EndSessionResponse(session_id=session_id)


@router.get("/sessions/{session_id}/map", response_model=WorkMap)
async def get_map(request: Request, session_id: str) -> WorkMap:
    repo: SessionRepository = request.app.state.session_repo
    work_map = repo.load_map(session_id)
    if work_map is None:
        raise HTTPException(status_code=404, detail="Map not found")
    return work_map
