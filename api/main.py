import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import config
from app.repositories.sessions import FileSessionRepository
from app.repositories.snapshots import FileSnapshotStore
from app.repositories.tutor import TutorRepository
from app.routers import (
    debrief,
    director,
    erp_events,
    frames,
    privacy,
    sessions,
    transcript,
    tutor,
    voice,
)
from app.services.image_redactor import (
    ImageRedactor,
    check_tesseract_or_raise,
    image_redaction_available,
    redaction_queue,
)

DATA_DIR = Path("api/data/sessions")
DATA_DIR.mkdir(parents=True, exist_ok=True)

TUTOR_DATA_DIR = Path("api/data/tutor")
TUTOR_DATA_DIR.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    worker_task: asyncio.Task | None = None
    if image_redaction_available():
        check_tesseract_or_raise()
        worker_task = asyncio.create_task(
            redaction_queue.start_worker(ImageRedactor())
        )
    try:
        yield
    finally:
        if worker_task is not None:
            worker_task.cancel()


app = FastAPI(title="AI Apprentice API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.allowed_origin],
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)

app.state.session_repo = FileSessionRepository(DATA_DIR)
app.state.snapshot_store = FileSnapshotStore(DATA_DIR)
app.state.snapshot_base_dir = DATA_DIR
app.state.last_frames: dict[str, str] = {}
app.state.tutor_repo = TutorRepository(TUTOR_DATA_DIR)

app.include_router(frames.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")
app.include_router(erp_events.router, prefix="/api")
app.include_router(voice.router, prefix="/api")
app.include_router(transcript.router, prefix="/api")
app.include_router(director.router, prefix="/api")
app.include_router(debrief.router, prefix="/api")
app.include_router(tutor.router, prefix="/api")
app.include_router(privacy.router, prefix="/api")
