import httpx
from fastapi import APIRouter, HTTPException

from app.config import config
from app.schemas import SignedUrlResponse

router = APIRouter()

_ELEVENLABS_SIGNED_URL = "https://api.elevenlabs.io/v1/convai/conversation/get-signed-url"


@router.get("/voice/signed-url", response_model=SignedUrlResponse)
async def get_signed_url(role: str = "interviewer") -> SignedUrlResponse:
    if not config.elevenlabs_api_key:
        raise HTTPException(status_code=503, detail="ElevenLabs credentials not configured")

    if role == "debrief":
        agent_id = config.elevenlabs_debrief_agent_id
        if not agent_id:
            raise HTTPException(status_code=503, detail="ElevenLabs debrief agent not configured")
    elif role == "tutor":
        agent_id = config.elevenlabs_tutor_agent_id
        if not agent_id:
            raise HTTPException(status_code=503, detail="ElevenLabs tutor agent not configured")
    else:
        agent_id = config.elevenlabs_agent_id
        if not agent_id:
            raise HTTPException(status_code=503, detail="ElevenLabs credentials not configured")

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            _ELEVENLABS_SIGNED_URL,
            params={"agent_id": agent_id},
            headers={"xi-api-key": config.elevenlabs_api_key},
            timeout=10.0,
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"ElevenLabs returned {resp.status_code}: {resp.text[:200]}",
        )

    data = resp.json()
    return SignedUrlResponse(signed_url=data["signed_url"])
