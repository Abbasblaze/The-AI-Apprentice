import time
from enum import Enum
from typing import Optional

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


class TranscriptEntry(BaseModel):
    role: TranscriptRole
    message: str
    t: float


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


class SessionSummary(BaseModel):
    session_id: str
    start_time: float
    end_time: Optional[float] = None
    event_count: int
    erp_event_count: int
    question_count: int


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
