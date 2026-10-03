from fastapi import APIRouter, Request

from app.repositories.sessions import SessionRepository
from app.schemas import TranscriptRequest, TranscriptResponse

router = APIRouter()


@router.post("/sessions/{session_id}/transcript")
async def post_transcript(
    request: Request, session_id: str, body: TranscriptRequest
) -> TranscriptResponse:
    repo: SessionRepository = request.app.state.session_repo
    repo.add_transcript_entries(session_id, body.entries)
    return TranscriptResponse(session_id=session_id, entries=repo.get_transcript(session_id))


@router.get("/sessions/{session_id}/transcript", response_model=TranscriptResponse)
async def get_transcript(request: Request, session_id: str) -> TranscriptResponse:
    repo: SessionRepository = request.app.state.session_repo
    return TranscriptResponse(session_id=session_id, entries=repo.get_transcript(session_id))
