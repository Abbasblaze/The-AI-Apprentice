from __future__ import annotations

import time
import uuid

from fastapi import APIRouter, HTTPException, Request
from openai import AsyncOpenAI
from pydantic import BaseModel

from app.config import config
from app.repositories.sessions import SessionRepository
from app.repositories.tutor import TutorRepository
from app.schemas import (
    CheckVerdict,
    MasterySummary,
    TutorIntervention,
    TutorSession,
    WorkMap,
)
from app.services.tutor_service import InvoiceStateIn, compute_mastery, judge_action

router = APIRouter()

_client = AsyncOpenAI(api_key=config.openai_api_key)


class CreateSessionBody(BaseModel):
    work_map_session_id: str


class CheckRequest(BaseModel):
    action_type: str
    action_value: str | None = None
    invoice: InvoiceStateIn


@router.post("/tutor/sessions", response_model=TutorSession)
async def create_tutor_session(request: Request, body: CreateSessionBody) -> TutorSession:
    map_repo: SessionRepository = request.app.state.session_repo
    tutor_repo: TutorRepository = request.app.state.tutor_repo

    work_map: WorkMap | None = map_repo.load_map(body.work_map_session_id)
    if work_map is None:
        raise HTTPException(status_code=404, detail="Work map not found")
    if not work_map.expert_confirmed and not work_map.demo_ready:
        raise HTTPException(status_code=400, detail="Work map is not confirmed or demo-ready")

    session = TutorSession(
        id=str(uuid.uuid4()),
        work_map_session_id=body.work_map_session_id,
        started_at=time.time(),
    )
    tutor_repo.save(session)
    return session


@router.get("/tutor/sessions", response_model=list[TutorSession])
async def list_tutor_sessions(request: Request) -> list[TutorSession]:
    tutor_repo: TutorRepository = request.app.state.tutor_repo
    return tutor_repo.list_sessions()


@router.get("/tutor/sessions/{session_id}", response_model=TutorSession)
async def get_tutor_session(session_id: str, request: Request) -> TutorSession:
    tutor_repo: TutorRepository = request.app.state.tutor_repo
    session = tutor_repo.load(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Tutor session not found")
    return session


@router.post("/tutor/sessions/{session_id}/end", response_model=TutorSession)
async def end_tutor_session(session_id: str, request: Request) -> TutorSession:
    tutor_repo: TutorRepository = request.app.state.tutor_repo
    session = tutor_repo.load(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Tutor session not found")
    session.ended_at = time.time()
    tutor_repo.save(session)
    return session


@router.post("/tutor/sessions/{session_id}/check", response_model=CheckVerdict)
async def check_action(
    session_id: str, body: CheckRequest, request: Request
) -> CheckVerdict:
    tutor_repo: TutorRepository = request.app.state.tutor_repo
    map_repo: SessionRepository = request.app.state.session_repo

    session = tutor_repo.load(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Tutor session not found")

    work_map = map_repo.load_map(session.work_map_session_id)
    if work_map is None:
        raise HTTPException(status_code=404, detail="Work map not found")

    verdict = await judge_action(
        tutor_session_id=session_id,
        action_type=body.action_type,
        action_value=body.action_value,
        invoice=body.invoice,
        work_map=work_map,
        client=_client,
    )

    session.verdicts.append(verdict)

    if verdict.verdict == "block":
        intervention = TutorIntervention(
            id=str(uuid.uuid4()),
            step_id=verdict.step_id,
            guardrail_id=verdict.guardrail_id,
            verdict=verdict,
            t=time.time(),
        )
        session.interventions.append(intervention)

    tutor_repo.save(session)
    return verdict


@router.post("/tutor/sessions/{session_id}/summary", response_model=MasterySummary)
async def get_tutor_summary(session_id: str, request: Request) -> MasterySummary:
    tutor_repo: TutorRepository = request.app.state.tutor_repo
    map_repo: SessionRepository = request.app.state.session_repo

    session = tutor_repo.load(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Tutor session not found")

    work_map = map_repo.load_map(session.work_map_session_id)
    if work_map is None:
        raise HTTPException(status_code=404, detail="Work map not found")

    mastery = compute_mastery(session, work_map)
    session.mastery = mastery
    tutor_repo.save(session)
    return mastery
