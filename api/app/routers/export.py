from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import JSONResponse, Response

from app.repositories.sessions import SessionRepository
from app.services import export_service

router = APIRouter()


@router.get("/sessions/{session_id}/map/export")
async def export_map(
    request: Request,
    session_id: str,
    format: str = Query(default="markdown", pattern="^(markdown|json)$"),
) -> Response:
    repo: SessionRepository = request.app.state.session_repo
    work_map = repo.load_map(session_id)

    if work_map is None:
        raise HTTPException(status_code=404, detail="Map not found")

    if not work_map.expert_confirmed:
        raise HTTPException(status_code=403, detail="Map has not been confirmed by the expert")

    debrief_state = repo.load_debrief_state(session_id)

    if format == "json":
        data = export_service.build_json(work_map, debrief_state)
        return JSONResponse(content=data)

    md = export_service.build_markdown(work_map, debrief_state)
    return Response(content=md, media_type="text/markdown")
