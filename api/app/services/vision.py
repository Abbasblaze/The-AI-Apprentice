import time
import uuid

from openai import AsyncOpenAI

from app.config import config
from app.schemas import AppEvent, EventListOutput, EventOutput, TokenUsage

_client = AsyncOpenAI(api_key=config.openai_api_key)

_SYSTEM_PROMPT = (
    "You watch a screen and extract structured events describing what changed. "
    "Read exact numbers, IDs, field names, and values directly from the screen — never invent values. "
    "If nothing meaningful changed, return an empty events list. "
    "Each event describes one discrete change. "
    "summary is one short sentence in past tense. "
    "Be concise. Return only the JSON."
)


def _build_context(context_events: list[AppEvent]) -> str:
    if not context_events:
        return "No prior events."
    return "\n".join(
        f"[{e.t:.1f}s] {e.kind.value}: {e.summary}" for e in context_events[-5:]
    )


async def analyse_frame(
    image_b64: str,
    t: float,
    context_events: list[AppEvent],
) -> tuple[list[AppEvent], TokenUsage, float]:
    user_text = (
        f"Elapsed: {t:.1f}s\n\n"
        f"Recent events:\n{_build_context(context_events)}\n\n"
        "List what changed on screen since the last event."
    )

    start = time.perf_counter()
    response = await _client.responses.parse(
        model=config.vision_model,
        input=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": user_text},
                    {
                        "type": "input_image",
                        "image_url": f"data:image/jpeg;base64,{image_b64}",
                        "detail": "low",
                    },
                ],
            },
        ],
        text_format=EventListOutput,
        text={"verbosity": "low"},
        reasoning={"effort": "low"},
        max_output_tokens=1000,
    )
    latency_ms = (time.perf_counter() - start) * 1000

    parsed: EventListOutput = response.output_parsed
    raw_usage = response.usage

    events = [
        AppEvent(
            id=str(uuid.uuid4()),
            t=t,
            kind=e.kind,
            subject=e.subject,
            field=e.field,
            from_value=e.from_value,
            to_value=e.to_value,
            summary=e.summary,
        )
        for e in parsed.events
    ]

    usage = TokenUsage(
        input_tokens=raw_usage.input_tokens,
        output_tokens=raw_usage.output_tokens,
        total_tokens=getattr(
            raw_usage,
            "total_tokens",
            raw_usage.input_tokens + raw_usage.output_tokens,
        ),
    )
    return events, usage, latency_ms
