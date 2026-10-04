import io
import time

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, Response

from app.repositories.sessions import SessionRepository
from app.schemas import (
    EndSessionResponse,
    MaskRegion,
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


def _mask_jpeg_bytes(data: bytes, mask_regions: list[MaskRegion]) -> bytes:
    from PIL import Image, ImageDraw

    image = Image.open(io.BytesIO(data)).convert("RGB")
    draw = ImageDraw.Draw(image)
    width, height = image.size
    for region in mask_regions:
        left = int(region.x * width)
        top = int(region.y * height)
        right = int((region.x + region.width) * width)
        bottom = int((region.y + region.height) * height)
        draw.rectangle([left, top, right, bottom], fill="black")
    out = io.BytesIO()
    image.save(out, format="JPEG")
    return out.getvalue()


@router.get("/sessions/{session_id}/snapshots/{t_str}")
async def get_snapshot(request: Request, session_id: str, t_str: str) -> Response:
    base_dir = request.app.state.snapshot_base_dir
    path = base_dir / session_id / "snapshots" / f"{t_str}.jpg"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Snapshot not found")

    repo: SessionRepository = request.app.state.session_repo
    mask_regions = repo.load_privacy(session_id).mask_regions
    if mask_regions:
        masked = _mask_jpeg_bytes(path.read_bytes(), mask_regions)
        return Response(content=masked, media_type="image/jpeg")
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
