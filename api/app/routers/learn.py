from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.repositories.sessions import SessionRepository
from app.schemas import WorkMap

router = APIRouter()


class LearnMapSummary(BaseModel):
    session_id: str
    process_name: str
    step_count: int
    guardrail_count: int
    confirmed_at: float | None
    expert_confirmed: bool
    demo_ready: bool


def _is_available(work_map: WorkMap) -> bool:
    return work_map.expert_confirmed or work_map.demo_ready


@router.get("/learn/maps", response_model=list[LearnMapSummary])
async def list_learn_maps(request: Request) -> list[LearnMapSummary]:
    repo: SessionRepository = request.app.state.session_repo
    sessions = repo.list_sessions()
    summaries: list[LearnMapSummary] = []
    for session in sessions:
        if not session.has_map:
            continue
        work_map = repo.load_map(session.session_id)
        if work_map is None or not _is_available(work_map):
            continue
        guardrail_count = sum(len(step.guardrails) for step in work_map.steps)
        summaries.append(
            LearnMapSummary(
                session_id=session.session_id,
                process_name=work_map.process_name,
                step_count=len(work_map.steps),
                guardrail_count=guardrail_count,
                confirmed_at=work_map.confirmed_at if hasattr(work_map, "confirmed_at") else None,
                expert_confirmed=work_map.expert_confirmed,
                demo_ready=work_map.demo_ready,
            )
        )
    return summaries


@router.get("/learn/maps/{session_id}", response_model=WorkMap)
async def get_learn_map(request: Request, session_id: str) -> WorkMap:
    repo: SessionRepository = request.app.state.session_repo
    work_map = repo.load_map(session_id)
    if work_map is None:
        raise HTTPException(status_code=404, detail="Work map not found")
    if not _is_available(work_map):
        raise HTTPException(status_code=403, detail="Work map is not confirmed or demo-ready")
    return work_map
