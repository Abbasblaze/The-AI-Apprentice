from fastapi import APIRouter, Request

from app.repositories.sessions import SessionRepository
from app.repositories.snapshots import SnapshotStore
from app.schemas import ErpEventRequest, SessionEventsResponse, SnapshotIndex

router = APIRouter()


@router.post("/sessions/{session_id}/erp-events", response_model=SessionEventsResponse)
async def post_erp_events(
    request: Request,
    session_id: str,
    body: ErpEventRequest,
) -> SessionEventsResponse:
    repo: SessionRepository = request.app.state.session_repo
    repo.add_erp_events(session_id, body.events)

    if body.events:
        snapshot_store: SnapshotStore = request.app.state.snapshot_store
        last_frame: str | None = request.app.state.last_frames.get(session_id)
        if last_frame:
            t = body.events[0].t
            saved = snapshot_store.save(session_id, t, last_frame)
            if saved:
                repo.add_snapshot(session_id, SnapshotIndex(t=t, filename=f"{t:.3f}.jpg"))

    return SessionEventsResponse(session_id=session_id, events=body.events)
