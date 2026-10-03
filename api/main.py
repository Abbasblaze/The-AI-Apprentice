from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import config
from app.repositories.sessions import InMemorySessionRepository
from app.routers import frames, sessions
from app.routers import director, transcript, voice

app = FastAPI(title="AI Apprentice API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.allowed_origin],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

app.state.session_repo = InMemorySessionRepository()
app.include_router(frames.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")
app.include_router(voice.router, prefix="/api")
app.include_router(transcript.router, prefix="/api")
app.include_router(director.router, prefix="/api")
