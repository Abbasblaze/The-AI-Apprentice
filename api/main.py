from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import config
from app.repositories.sessions import FileSessionRepository
from app.repositories.snapshots import FileSnapshotStore
from app.routers import debrief, director, erp_events, frames, sessions, transcript, voice

DATA_DIR = Path("api/data/sessions")
DATA_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="AI Apprentice API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.allowed_origin],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

app.state.session_repo = FileSessionRepository(DATA_DIR)
app.state.snapshot_store = FileSnapshotStore(DATA_DIR)
app.state.snapshot_base_dir = DATA_DIR
app.state.last_frames: dict[str, str] = {}

app.include_router(frames.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")
app.include_router(erp_events.router, prefix="/api")
app.include_router(voice.router, prefix="/api")
app.include_router(transcript.router, prefix="/api")
app.include_router(director.router, prefix="/api")
app.include_router(debrief.router, prefix="/api")
