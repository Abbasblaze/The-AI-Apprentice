from fastapi import APIRouter, HTTPException, Request

from app.repositories.sessions import SessionRepository
from app.schemas import DirectorDecideRequest, DirectorDecideResponse, ErrorBody
from app.services import director as director_service

router = APIRouter()


@router.post(
    "/director/decide",
    response_model=DirectorDecideResponse,
    responses={500: {"model": ErrorBody}},
)
async def decide(request: Request, body: DirectorDecideRequest) -> DirectorDecideResponse:
    repo: SessionRepository = request.app.state.session_repo
    events = repo.get_events(body.session_id)
    transcript = repo.get_transcript(body.session_id)
    decisions = repo.get_director_decisions(body.session_id)

    try:
        response, stored = await director_service.decide(
            session_id=body.session_id,
            elapsed_seconds=body.elapsed_seconds,
            events=events,
            transcript=transcript,
            decisions=decisions,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    repo.add_director_decision(body.session_id, stored)
    return response
