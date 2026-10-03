from enum import Enum
from typing import Optional

from pydantic import BaseModel


class EventKind(str, Enum):
    opened = "opened"
    changed = "changed"
    typed = "typed"
    selected = "selected"
    navigated = "navigated"
    error = "error"
    other = "other"


class AppEvent(BaseModel):
    id: str
    t: float
    kind: EventKind
    subject: str
    field: Optional[str] = None
    from_value: Optional[str] = None
    to_value: Optional[str] = None
    summary: str


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
