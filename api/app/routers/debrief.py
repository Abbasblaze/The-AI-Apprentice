from __future__ import annotations

import time

from fastapi import APIRouter, HTTPException, Request
from openai import AsyncOpenAI
from pydantic import BaseModel

from app.config import config
from app.repositories.sessions import SessionRepository
from app.schemas import (
    DebriefPhase,
    DebriefState,
)
from app.services import map_service
from app.services.map_service import _should_move_to_teachback

router = APIRouter()

_client = AsyncOpenAI(api_key=config.openai_api_key)

_MAX_TEACHBACK_ROUNDS = 3


class _AnswerBody(BaseModel):
    answer: str


class _ReplyBody(BaseModel):
    reply: str


@router.post("/sessions/{session_id}/debrief/start")
async def start_debrief(request: Request, session_id: str) -> dict:
    repo: SessionRepository = request.app.state.session_repo
    record = repo.get_session_record(session_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if record.end_time is None:
        raise HTTPException(status_code=400, detail="Session has not ended")

    work_map, gaps = await map_service.draft_map(record, _client)

    first_open = next((g for g in gaps if not g.closed), None)
    if first_open is None:
        raise HTTPException(status_code=500, detail="No gaps generated")

    state = DebriefState(
        phase=DebriefPhase.gathering,
        gaps=gaps,
        gaps_answered=0,
        map=work_map,
    )

    repo.save_debrief_state(session_id, state)
    repo.save_map(session_id, work_map)

    return {
        "gap": first_open,
        "state": {
            "phase": state.phase.value,
            "gaps_answered": state.gaps_answered,
            "total_gaps": len(gaps),
        },
        "map": work_map,
    }


@router.post("/sessions/{session_id}/debrief/answer")
async def answer_debrief(request: Request, session_id: str, body: _AnswerBody) -> dict:
    repo: SessionRepository = request.app.state.session_repo
    state = repo.load_debrief_state(session_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Debrief not started")
    if state.phase != DebriefPhase.gathering:
        raise HTTPException(status_code=400, detail="Debrief is not in gathering phase")

    current_gap = next((g for g in state.gaps if not g.closed), None)
    if current_gap is None:
        raise HTTPException(status_code=400, detail="No open gaps remaining")

    all_transcript = repo.get_transcript(session_id)

    updated_map, updated_gaps, follow_up = await map_service.apply_answer(
        work_map=state.map,
        gaps=state.gaps,
        gap_id=current_gap.id,
        answer_text=body.answer,
        all_transcript=all_transcript,
        client=_client,
    )

    new_gaps_answered = state.gaps_answered + 1

    updated_state = state.model_copy(update={
        "gaps": updated_gaps,
        "gaps_answered": new_gaps_answered,
        "map": updated_map,
    })

    should_move, move_reason = _should_move_to_teachback(updated_state)

    teachback_text: str | None = None
    if should_move:
        teachback_text = await map_service.generate_teachback(updated_map, _client)
        updated_state = updated_state.model_copy(update={
            "phase": DebriefPhase.teachback,
            "teachback_text": teachback_text,
            "move_reason": move_reason,
        })

    repo.save_debrief_state(session_id, updated_state)
    repo.save_map(session_id, updated_map)

    next_gap = next((g for g in updated_gaps if not g.closed), None) if not should_move else None

    return {
        "next_gap": next_gap,
        "teachback": teachback_text,
        "move_reason": move_reason if should_move else None,
        "map": updated_map,
    }


@router.get("/sessions/{session_id}/debrief/teachback")
async def get_teachback(request: Request, session_id: str) -> dict:
    repo: SessionRepository = request.app.state.session_repo
    state = repo.load_debrief_state(session_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Debrief not started")
    return {"teachback": state.teachback_text}


@router.post("/sessions/{session_id}/debrief/teachback")
async def regenerate_teachback(request: Request, session_id: str) -> dict:
    repo: SessionRepository = request.app.state.session_repo
    state = repo.load_debrief_state(session_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Debrief not started")
    if state.map is None:
        raise HTTPException(status_code=400, detail="No map available")
    teachback_text = await map_service.generate_teachback(state.map, _client)
    updated_state = state.model_copy(update={"teachback_text": teachback_text})
    repo.save_debrief_state(session_id, updated_state)
    return {"teachback": teachback_text}


@router.post("/sessions/{session_id}/debrief/reply")
async def reply_debrief(request: Request, session_id: str, body: _ReplyBody) -> dict:
    repo: SessionRepository = request.app.state.session_repo
    state = repo.load_debrief_state(session_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Debrief not started")
    if state.phase != DebriefPhase.teachback:
        raise HTTPException(status_code=400, detail="Debrief is not in teachback phase")
    if len(state.teachback_rounds) >= _MAX_TEACHBACK_ROUNDS:
        raise HTTPException(status_code=400, detail="Maximum teachback rounds reached")

    all_transcript = repo.get_transcript(session_id)

    output, updated_map = await map_service.classify_reply(
        reply_text=body.reply,
        work_map=state.map,
        all_transcript=all_transcript,
        client=_client,
    )

    from app.schemas import TeachbackRound

    round_entry = TeachbackRound(
        text=state.teachback_text or "",
        expert_reply=body.reply,
        classification=output.classification,
        correction=output.correction,
        patch_summary=output.partial_teachback,
    )

    updated_rounds = [*state.teachback_rounds, round_entry]

    confirmed = output.classification == "confirmed"
    confirmed_at: float | None = None
    new_phase = state.phase

    if confirmed:
        confirmed_at = time.time()
        new_phase = DebriefPhase.confirmed
        updated_map = updated_map.model_copy(update={
            "expert_confirmed": True,
            "confirmed_at": confirmed_at,
            "teachback_rounds": updated_rounds,
        })

    updated_state = state.model_copy(update={
        "phase": new_phase,
        "teachback_rounds": updated_rounds,
        "map": updated_map,
    })

    repo.save_debrief_state(session_id, updated_state)
    repo.save_map(session_id, updated_map)

    return {
        "classification": output.classification,
        "partial_teachback": output.partial_teachback,
        "confirmed": confirmed,
        "map": updated_map,
    }
