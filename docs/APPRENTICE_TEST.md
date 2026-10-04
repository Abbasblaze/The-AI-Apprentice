# Apprentice Test: Five Questions from the Challenge Brief

Plain-language answers. Each answer is grounded in the actual code; file paths and function names are exact.

---

## Q1: When does the Apprentice ask a question?

Two gates must both open.

**Gate 1 — the pause detector** (`web/src/lib/pauseDetector.ts`, `shouldAsk()`, line 23)

Six conditions are checked on every tick. All six must be true or `shouldAsk` returns false:

1. Not in off-record mode (`isOffRecord == false`)
2. The voice output is not currently speaking (`isSpeaking == false`)
3. No answer is already being waited for (`isPendingAnswer == false`)
4. The screen has been quiet for at least 2,500 ms (`nowMs - lastScreenChangeMs >= screenQuietMs`)
5. The user has not spoken for at least 2,500 ms (`nowMs - lastUserSpeechMs >= speechQuietMs`)
6. At least 90,000 ms (90 seconds) have elapsed since the last question (`minQuestionIntervalMs`)

The defaults are set in `DEFAULT_PAUSE_CONFIG` at lines 7–11. If any condition fails, no question is even attempted.

**Gate 2 — the director** (`api/app/services/director.py`, `decide()`, line 108)

When the pause detector says it is safe to ask, the frontend calls the director. The director applies three more checks:

- **Budget**: no more than 5 questions may be asked in any rolling 600-second (10-minute) window (`_within_budget()`, line 48; constants at lines 21–22). If the budget is exhausted the director returns `should_ask=false` immediately.
- **Anchor validation**: the model must anchor its question to a specific event id from the session. If `anchor_event_id` does not match any recorded event, the question is rejected (`_valid_anchor()`, line 60).
- **Duplicate detection**: if the new question shares more than 60% of its significant words with any previously asked question, it is rejected (`_is_repeat()`, line 69).

Only if the budget is available, the anchor is valid, and the question is not a repeat does the director set `should_ask=true`.

---

## Q2: What does it ask?

**Source**: `api/app/services/director.py`, `_SYSTEM_PROMPT` (lines 25–38) and `decide()` (line 108).

The director sends two things to the model:

- The last 25 screen events (`_build_events_context()`, line 83; slicing at line 84: `events[-25:]`)
- The last 20 transcript entries (`_build_transcript_context()`, line 95; slicing at line 98: `entries[-20:]`)

The system prompt tells the model to:

> "Pick decisions, not routine actions: a value that changed, a record moved, a step skipped, an item held. Phrase the question around the specific visible detail — one short sentence, not answerable with yes or no."

The question must anchor to a specific event id. The model also assigns a kind from the enum `QuestionKind` (`api/app/schemas.py`): `reason`, `limit`, `exception`, `escalation`, or `guardrail`.

**Forced guardrail**: if 240 or more seconds have elapsed since the session started and no guardrail-kind question has been asked, the next question's kind is forced to `guardrail` regardless of what the model returned. This is enforced by `_should_force_guardrail()` at line 54 (constant `_GUARDRAIL_FORCE_AFTER_SECONDS = 240.0` at line 23) and applied at line 224.

---

## Q3: When has it understood? (the stopping rule)

**Source**: `api/app/services/map_service.py`, `_should_move_to_teachback()` (line 91); constants at lines 86–88.

After each answer the debrief router calls `_should_move_to_teachback`. It moves to teachback when either:

- **Hard stop**: 8 questions have been answered (`_HARD_STOP_GAPS = 8`). Always moves, no other checks.
- **Soft stop**: all three conditions are met:
  1. At least 3 gaps have been answered (`_MIN_GAPS_ANSWERED = 3`)
  2. No high-priority gaps are still open (`open_high` list is empty, line 94)
  3. Every step in the map has confidence >= 0.8 (`_MIN_STEP_CONFIDENCE = 0.8`, line 88; checked at line 100)

**Teachback confirmation** (`api/app/routers/debrief.py`, `reply_debrief()`, line 148):

Once the stopping rule fires, a ~200-word teachback is generated and read back to the expert. The expert replies. The reply is classified as `confirmed`, `corrected`, or `unclear`. Up to 3 rounds are allowed (`_MAX_TEACHBACK_ROUNDS = 3`, line 22). The map is confirmed when the expert's reply is classified as `confirmed` (line 180), which sets `expert_confirmed=True` on the WorkMap.

---

## Q4: Whether the new hire learned

**Source**: `api/app/services/tutor_service.py`, `compute_mastery()` (line 220).

After a tutor session, `compute_mastery` iterates over every step in the WorkMap.

A step is **mastered** if (line 241):

```
mastered = attempted AND (predicted_correctly OR (blocked == 0 AND hints_used == 0))
```

- `attempted`: the new hire made at least one prediction or triggered at least one intervention for this step.
- `predicted_correctly`: at least one prediction for this step was evaluated as correct.
- `blocked == 0 AND hints_used == 0`: the new hire went through the step without being blocked by a guardrail and without needing a hint (clean pass).

The function returns a `MasterySummary` with `mastered_steps` (titles of mastered steps), `practice_next` (titles of steps not yet mastered), per-step `StepMastery` records, and per-guardrail `GuardrailMastery` records.

**Guardrail judge** (line 92, `judge_action()`):

Before checking the LLM, the judge runs a numeric threshold check (`_numeric_verdict()`, line 57) — for example, the EUR 5,000 capex/opex guardrail is caught here by comparing `invoice.amount` directly against the stored threshold. If the numeric check is inconclusive, the judge calls gpt-5-nano with a 4-second timeout (line 138, `asyncio.wait_for(..., timeout=4.0)`). If the LLM times out, the verdict falls through to `allow` (line 153–158).

---

## Q5: Trust (privacy)

**Source**: `api/app/services/redactor.py` and `api/app/routers/privacy.py`.

Four mechanisms:

**Text redaction** (`redactor.py`, `_build_redactor()`, line 50):
Uses Microsoft Presidio with the spaCy `en_core_web_lg` NLP model. Six entity types are recognized and replaced with placeholder tokens: `PERSON → [PERSON]`, `NAME → [NAME]`, `IBAN → [IBAN]`, `VAT_ID → [VAT_ID]`, `EMAIL_ADDRESS → [EMAIL]`, `PHONE_NUMBER → [PHONE]`. IBAN and VAT_ID use custom regex recognizers with European patterns (lines 27–45) because Presidio's built-in recognizers do not cover these.

**Off the record** (`privacy.py`, `post_off_record()`, line 63):
`POST /sessions/{id}/off-record` with a start_t and end_t marks a time window. Events that fall inside that window are excluded from the debrief context, so they never feed into the Work Map. The `isOffRecord` flag in the frontend's pause detector also prevents any questions from being asked during that window.

**Forget that** (`privacy.py`, `forget_last_qa()`, line 57; implementation in `sessions.py` `InMemorySessionRepository.forget_last_qa()`, line 218):
`POST /sessions/{id}/forget` removes the last answered Q&A from the decisions list, removes the corresponding user transcript entry, and deletes all events and snapshots that fall in the 120-second window before the current time (`window_seconds=120.0`).

**Mask regions** (`privacy.py`, `post_masks()`, line 83):
`POST /sessions/{id}/masks` accepts a list of screen regions (x, y, width, height). The image redactor (`api/app/services/image_redactor.py`) draws those regions as black rectangles over the stored JPEG snapshots at serve time.
