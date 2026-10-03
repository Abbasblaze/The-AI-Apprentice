from fastapi import APIRouter, HTTPException, Request

from app.repositories.sessions import SessionRepository
from app.repositories.snapshots import SnapshotStore
from app.schemas import ErrorBody, FrameRequest, FrameResponse, SnapshotIndex
from app.services.vision import analyse_frame

router = APIRouter()


@router.post(
    "/frames",
    response_model=FrameResponse,
    responses={500: {"model": ErrorBody}},
)
async def post_frame(request: Request, body: FrameRequest) -> FrameResponse:
    repo: SessionRepository = request.app.state.session_repo
    context_events = repo.get_events(body.session_id)

    try:
        events, usage, latency_ms = await analyse_frame(
            image_b64=body.image,
            t=body.t,
            context_events=context_events,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    request.app.state.last_frames[body.session_id] = body.image

    if events:
        repo.add_events(body.session_id, events)
        snapshot_store: SnapshotStore = request.app.state.snapshot_store
        saved = snapshot_store.save(body.session_id, body.t, body.image)
        if saved:
            repo.add_snapshot(
                body.session_id, SnapshotIndex(t=body.t, filename=f"{body.t:.3f}.jpg")
            )
    else:
        repo.add_events(body.session_id, events)

    return FrameResponse(events=events, usage=usage, latency_ms=latency_ms)
