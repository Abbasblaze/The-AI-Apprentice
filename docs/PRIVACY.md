# Privacy

This document describes what data The AI Apprentice captures, where it goes, and
what it does and does not protect.

## 1. What data this tool captures

During a capture session the tool collects:

- Screen frames from the window or screen you choose to share. Frames are sampled
  every few seconds and only sent when the screen content changes.
- A text transcript of the voice interview between you and the interviewer agent.
- Structured events describing what happened on screen (for example, a field
  changed from one value to another).
- Structured events from the built-in ERP sandbox.
- JPEG snapshots of the screen at the moments events were detected.

## 2. Where data goes at each step

- Screen frames are sent to the backend, which forwards them to the OpenAI vision
  model to extract events. Frames are also saved to disk as JPEG snapshots under
  `api/data/sessions/<session_id>/snapshots/`.
- Voice audio is handled by ElevenLabs. The spoken conversation is transcribed and
  the text transcript is sent to the backend.
- Transcripts, events, ERP events, and decisions are stored on the local disk in
  `api/data/sessions/<session_id>/session.json`.
- Privacy metadata (the redaction log, off-record periods, mask regions, and
  forget-that records) is stored in
  `api/data/sessions/<session_id>/privacy.json`.

## 3. Redaction

Text redaction runs on the backend using Microsoft Presidio before data is stored:

- Transcript messages are redacted before being written to disk.
- Screen events and ERP events have their text fields redacted before being stored.

The following are detected and replaced with placeholders:

- Names (`[PERSON]`, `[NAME]`), including the sandbox names Hartmann, Meier, Böhm,
  Fischer, and Novak.
- IBANs (`[IBAN]`) for several European formats.
- VAT IDs (`[VAT_ID]`) for several European formats.
- Email addresses (`[EMAIL]`).
- Phone numbers (`[PHONE]`).

Snapshots are redacted separately. Mask regions you draw are always burned into the
image. If the Presidio image redactor and Tesseract OCR are installed, detected text
in the image is also blacked out. Image redaction runs off the request path in a
background queue; failures are logged and do not block capture.

## 4. What is not covered

- The vision model sees each screen frame in full before any text redaction is
  applied to the extracted events. Redaction protects the stored text, not the
  content that was sent to the model for analysis.
- If snapshot image redaction is unavailable (Presidio image redactor or Tesseract
  not installed), only the mask regions you draw are applied to snapshots. Other
  on-screen personal data in those images is not automatically removed.
- ElevenLabs processes your voice audio. This tool does not control how ElevenLabs
  stores or retains that audio.
- OpenAI processes screen frames and text prompts. This tool does not control
  OpenAI's data retention.
- Redaction is pattern and model based. It can miss personal data that does not
  match a known pattern, and it can over-redact.

## 5. Off the record

You can pause capture at any time:

- Say "off the record" or press Alt+R, or use the "Off the record" button.
- While off the record, no screen frames, events, or transcript entries are captured
  or sent.
- Say "back on the record", press Alt+R again, or use "Resume recording" to continue.

Each off-record period is recorded (start and end time) and shown in the privacy
panel and as a gap marker in the event ledger.

## 6. Deleting a session

- "Forget that" removes the last answered question, its transcript answer, and the
  events and snapshots from roughly the last two minutes, including the snapshot
  files on disk.
- The privacy panel (Sessions → Privacy) shows a summary of what was captured and
  redacted and lets you delete the entire session. Deleting removes the session
  directory and all its snapshots from disk and cannot be undone.
