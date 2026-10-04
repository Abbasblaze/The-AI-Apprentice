from fastapi import APIRouter, Request

from app.repositories.sessions import SessionRepository
from app.schemas import (
    ForgetThatRecord,
    MaskRegionsRequest,
    OffRecordPeriod,
    OffRecordRequest,
    PrivacySummary,
)
from app.services.image_redactor import redaction_queue

router = APIRouter()


def _build_summary(repo: SessionRepository, session_id: str) -> PrivacySummary:
    privacy = repo.load_privacy(session_id)
    record = repo.get_session_record(session_id)

    redaction_counts: dict[str, int] = {}
    redaction_by_location: dict[str, int] = {}
    for entry in privacy.redaction_log:
        redaction_counts[entry.entity_type] = (
            redaction_counts.get(entry.entity_type, 0) + entry.count
        )
        redaction_by_location[entry.location] = (
            redaction_by_location.get(entry.location, 0) + entry.count
        )

    return PrivacySummary(
        session_id=session_id,
        total_events=len(record.events) if record else 0,
        total_erp_events=len(record.erp_events) if record else 0,
        total_transcript_entries=len(record.transcript) if record else 0,
        total_snapshots=len(record.snapshots) if record else 0,
        redaction_counts=redaction_counts,
        redaction_by_location=redaction_by_location,
        off_record_periods=privacy.off_record_periods,
        forget_that_records=privacy.forget_that_records,
        mask_region_count=len(privacy.mask_regions),
    )


@router.get("/sessions/{session_id}/privacy", response_model=PrivacySummary)
async def get_privacy(request: Request, session_id: str) -> PrivacySummary:
    repo: SessionRepository = request.app.state.session_repo
    return _build_summary(repo, session_id)


@router.delete("/sessions/{session_id}")
async def delete_session(request: Request, session_id: str) -> dict[str, bool]:
    repo: SessionRepository = request.app.state.session_repo
    repo.delete_session(session_id)
    return {"deleted": True}


@router.post("/sessions/{session_id}/forget", response_model=ForgetThatRecord)
async def forget_last_qa(request: Request, session_id: str) -> ForgetThatRecord:
    repo: SessionRepository = request.app.state.session_repo
    return repo.forget_last_qa(session_id)


@router.post("/sessions/{session_id}/off-record")
async def post_off_record(
    request: Request, session_id: str, body: OffRecordRequest
) -> dict[str, bool]:
    repo: SessionRepository = request.app.state.session_repo
    privacy = repo.load_privacy(session_id)
    privacy.off_record_periods.append(
        OffRecordPeriod(start_t=body.start_t, end_t=body.end_t)
    )
    repo.save_privacy(session_id, privacy)
    return {"saved": True}


@router.get("/sessions/{session_id}/masks")
async def get_masks(request: Request, session_id: str) -> MaskRegionsRequest:
    repo: SessionRepository = request.app.state.session_repo
    privacy = repo.load_privacy(session_id)
    return MaskRegionsRequest(mask_regions=privacy.mask_regions)


@router.post("/sessions/{session_id}/masks")
async def post_masks(
    request: Request, session_id: str, body: MaskRegionsRequest
) -> MaskRegionsRequest:
    repo: SessionRepository = request.app.state.session_repo
    privacy = repo.load_privacy(session_id)
    privacy.mask_regions = body.mask_regions
    repo.save_privacy(session_id, privacy)

    base_dir = request.app.state.snapshot_base_dir
    snapshots_dir = base_dir / session_id / "snapshots"
    if snapshots_dir.exists():
        for snap in repo.get_snapshots(session_id):
            snap_path = snapshots_dir / snap.filename
            if snap_path.exists():
                redaction_queue.submit(
                    session_id, snap.t, snap_path, list(body.mask_regions)
                )

    return MaskRegionsRequest(mask_regions=body.mask_regions)
