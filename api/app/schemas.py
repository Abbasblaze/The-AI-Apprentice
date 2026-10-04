from __future__ import annotations

import time
from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field


class EventKind(str, Enum):
    opened = "opened"
    changed = "changed"
    typed = "typed"
    selected = "selected"
    navigated = "navigated"
    error = "error"
    other = "other"


class EventSource(str, Enum):
    vision = "vision"
    erp = "erp"


class AppEvent(BaseModel):
    id: str
    t: float
    kind: EventKind
    subject: str
    field: Optional[str] = None
    from_value: Optional[str] = None
    to_value: Optional[str] = None
    summary: str
    source: EventSource = EventSource.vision


class EventOutput(BaseModel):
    kind: EventKind
    subject: str
    field: Optional[str] = None
    from_value: Optional[str] = None
    to_value: Optional[str] = None
    summary: str


class EventListOutput(BaseModel):
    events: list[EventOutput]


class FrameRequest(BaseModel):
    session_id: str
    t: float
    image: str


class TokenUsage(BaseModel):
    input_tokens: int
    output_tokens: int
    total_tokens: int


class FrameResponse(BaseModel):
    events: list[AppEvent]
    usage: TokenUsage
    latency_ms: float


class ErrorBody(BaseModel):
    detail: str


class SessionEventsResponse(BaseModel):
    session_id: str
    events: list[AppEvent]


class TranscriptRole(str, Enum):
    user = "user"
    agent = "agent"


class TranscriptPhase(str, Enum):
    interview = "interview"
    debrief = "debrief"


class TranscriptEntry(BaseModel):
    role: TranscriptRole
    message: str
    t: float
    phase: TranscriptPhase = TranscriptPhase.interview


class TranscriptRequest(BaseModel):
    entries: list[TranscriptEntry]


class TranscriptResponse(BaseModel):
    session_id: str
    entries: list[TranscriptEntry]


class QuestionKind(str, Enum):
    reason = "reason"
    limit = "limit"
    exception = "exception"
    escalation = "escalation"
    guardrail = "guardrail"


class DirectorDecisionOutput(BaseModel):
    should_ask: bool
    kind: QuestionKind
    anchor_event_id: str
    question: str
    why: str


class DirectorDecideRequest(BaseModel):
    session_id: str
    elapsed_seconds: float


class DirectorDecideResponse(BaseModel):
    should_ask: bool
    kind: QuestionKind
    anchor_event_id: str
    question: str
    why: str
    rejected_reason: Optional[str] = None


class StoredDecision(BaseModel):
    id: str
    t: float
    should_ask: bool
    kind: QuestionKind
    anchor_event_id: str
    question: str
    why: str
    rejected_reason: Optional[str] = None
    answered: bool = False
    answer_text: Optional[str] = None


class SignedUrlResponse(BaseModel):
    signed_url: str


class ErpEventRequest(BaseModel):
    events: list[AppEvent]


class SnapshotIndex(BaseModel):
    t: float
    filename: str


class SessionData(BaseModel):
    session_id: str
    start_time: float = Field(default_factory=time.time)
    end_time: Optional[float] = None
    events: list[AppEvent] = []
    erp_events: list[AppEvent] = []
    transcript: list[TranscriptEntry] = []
    decisions: list[StoredDecision] = []
    snapshots: list[SnapshotIndex] = []
    debrief_state: Optional[DebriefState] = None


class SessionSummary(BaseModel):
    session_id: str
    start_time: float
    end_time: Optional[float] = None
    event_count: int
    erp_event_count: int
    question_count: int
    has_map: bool = False
    debrief_phase: Optional[str] = None


class SessionRecord(BaseModel):
    session_id: str
    start_time: float
    end_time: Optional[float] = None
    events: list[AppEvent]
    erp_events: list[AppEvent]
    transcript: list[TranscriptEntry]
    decisions: list[StoredDecision]
    snapshots: list[SnapshotIndex]


class SessionListResponse(BaseModel):
    sessions: list[SessionSummary]


class EndSessionResponse(BaseModel):
    session_id: str


class GuardrailKind(str, Enum):
    limit = "limit"
    exception = "exception"
    hold = "hold"
    stop_and_ask = "stop_and_ask"


class GapKind(str, Enum):
    missing_reason = "missing_reason"
    unclear_guardrail = "unclear_guardrail"
    scope = "scope"
    authority = "authority"
    unseen_case = "unseen_case"
    never_do = "never_do"


class GapPriority(str, Enum):
    high = "high"
    normal = "normal"


class Gap(BaseModel):
    id: str
    step_id: Optional[str] = None
    kind: GapKind
    question: str
    priority: GapPriority
    closed: bool = False


class ScreenMoment(BaseModel):
    t: float
    snapshot_t: float
    subject: str


class StepReason(BaseModel):
    text: str
    quote: Optional[str] = None
    quote_t: Optional[float] = None
    unconfirmed: bool = False


class Guardrail(BaseModel):
    id: str
    kind: GuardrailKind
    rule: str
    quote: str
    quote_t: float
    who_to_ask: Optional[str] = None
    applies_to: Optional[str] = None


class Step(BaseModel):
    id: str
    order: int
    title: str
    screen_moment: ScreenMoment
    decision: str
    reason: StepReason
    is_judgment_call: bool
    guardrails: list[Guardrail] = []
    confidence: float
    open_gaps: list[str] = []


class TeachbackRound(BaseModel):
    text: str
    expert_reply: str
    classification: Literal["confirmed", "corrected", "unclear"]
    correction: Optional[str] = None
    patch_summary: Optional[str] = None


class WorkMap(BaseModel):
    session_id: str
    process_name: str
    summary: str
    steps: list[Step]
    expert_confirmed: bool = False
    confirmed_at: Optional[float] = None
    teachback_rounds: list[TeachbackRound] = []
    version: int = 1


class DebriefPhase(str, Enum):
    gathering = "gathering"
    teachback = "teachback"
    confirmed = "confirmed"


class DebriefState(BaseModel):
    phase: DebriefPhase = DebriefPhase.gathering
    gaps: list[Gap] = []
    gaps_answered: int = 0
    map: Optional[WorkMap] = None
    teachback_text: Optional[str] = None
    teachback_rounds: list[TeachbackRound] = []
    move_reason: Optional[str] = None
