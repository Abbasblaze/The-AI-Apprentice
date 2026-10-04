# Demo Script — 4-Minute Walkthrough

**Process**: Equipment invoice coding in a fake ERP system
**Map used**: "Equipment invoice coding" with EUR 5,000 capex/opex guardrail

**Roles**:
- **Expert** = senior engineer who knows the process (the person at the keyboard during recording)
- **New Hire** = judge who will be tested by the tutor after the map is confirmed

Keep both roles in the room. Swap the keyboard after Step 4.

---

## Before you start

- Open the app at `http://localhost:3000` in a browser.
- Have the fake ERP loaded (Invoice list visible, a few invoices pre-populated).
- Open the browser microphone permission prompt and accept it.
- Turn speakers up so the voice questions are audible.
- Have a fallback plan ready: see "Fallbacks" at the bottom.

---

## Step 0 — Setup (0:00 – 0:20)

Say to the judges:

> "This is the AI Apprentice. It watches an expert do a task, asks voice questions to understand their reasoning, builds a step-by-step Work Map, and then uses that map to teach and test a new hire — including blocking mistakes in real time."

Click **New Session** to start recording.

---

## Step 1 — Expert records the task (0:20 – 1:30)

The Expert sits at the keyboard. Say:

> "Sabine is our senior AP specialist. She's going to code two invoices. I'll let her work without interruption."

**Expert actions** (narrate aloud while doing them, slowly):

| Time from start | Action |
|---|---|
| 0:30 | Open invoice 4471 — EUR 3,200, supplier Hartmann GmbH |
| 0:40 | Set Cost Center to `OPEX-220` |
| 0:50 | Add internal note: "Standard equipment under threshold" |
| 1:00 | Click Post |
| 1:05 | Open invoice 4472 — EUR 6,800, supplier Fischer AG |
| 1:15 | Change Cost Center from `OPEX-220` to `CAPEX-110` |
| 1:20 | Add internal note: "Over 5k — must go capex per policy" |
| 1:28 | Click Send for Approval instead of Post |

The Apprentice should ask its first question around 1:10–1:20, anchored to the cost center change on the second invoice. If it does not ask within 30 seconds of the change, that is fine — it is waiting for a quiet moment.

**Expert answers the question aloud** (the microphone is always on):

> "Anything over five thousand euros goes to capital expenditure. That's a company policy — I can't post it directly, it needs sign-off."

Pause. Let the voice finish. The system records the answer.

---

## Step 2 — End recording and start debrief (1:30 – 2:00)

Expert clicks **Stop Recording**.

Click **Start Debrief**. The system drafts the Work Map and opens the first gap question.

Say to the judges:

> "The Apprentice has seen the screen events and heard the answers. Now it asks structured questions to fill in what it doesn't know."

The first gap question will appear on screen and be read aloud. It will be something like:

> "What happens if an invoice is sent for approval and the approver is out of office?"

Expert answers aloud:

> "It escalates to the finance manager after 48 hours. There's a backup in the system."

Continue answering gap questions. The system needs at least 3 answered and all high-priority gaps closed before it moves on (hard stop at 8).

---

## Step 3 — Teachback and confirmation (2:00 – 2:30)

After 3–4 questions, the system generates a teachback and reads it aloud — a ~200-word summary of the steps, decisions, and guardrails.

Say to the judges:

> "It reads back what it learned. The expert confirms or corrects."

Expert says (aloud, into the mic):

> "Confirmed."

The map is locked. Show the Work Map screen. Point out the EUR 5,000 guardrail in the guardrail list.

Optional: click **Export** (top right of map view) to show the markdown export at `GET /sessions/{id}/map/export?format=markdown`. This is the machine-readable output that could be loaded into an agent system.

---

## Step 4 — New Hire is tested by the tutor (2:30 – 3:30)

Hand the keyboard to the New Hire judge. Click **Start Tutor Session**.

Say:

> "Now the Apprentice plays the role of trainer. It shows the new hire the same invoices and watches what they do."

**New Hire actions**:

| Time from start | Action |
|---|---|
| 2:35 | Open invoice 4473 — EUR 6,200, Böhm Technik |
| 2:45 | Try to set Cost Center to `OPEX-220` and click Post |

The guardrail fires. The system blocks the action and says something like:

> "Sabine would stop here. Why do you think?"

New Hire answers:

> "Because it's over five thousand euros — it should be capex."

The system evaluates the answer and allows the corrected action.

New Hire changes Cost Center to `CAPEX-110`, clicks Send for Approval. The system allows it.

---

## Step 5 — Mastery summary (3:30 – 3:50)

Click **End Tutor Session**. The system shows the mastery summary.

Point out:

- Which steps were mastered (predicted correctly or clean pass).
- Which guardrails were tested and whether the new hire corrected after being blocked.

Say to the judges:

> "The map came from Sabine's reasoning, verified by her. The guardrail was captured because the Apprentice asked about it during recording. The new hire was tested against that exact rule."

---

## Step 6 — Privacy controls (3:50 – 4:00)

Quick show: click the **Trust & Privacy** panel.

Point out:
- Redacted entity count (PERSON names replaced with `[PERSON]`).
- Off-record button (marks a time window — nothing in that window enters the map).
- Forget That button (removes the last Q&A and 120 seconds of events/snapshots).

Done.

---

## Fallbacks

**If voice fails (ElevenLabs or microphone unavailable)**:
- Type answers into the text input that appears below the voice prompt.
- The system accepts typed answers the same way it accepts spoken ones.
- Say: "We're using text input today because of audio setup in this room."

**If the director does not ask a question during recording**:
- The 90-second minimum interval and 2.5-second quiet windows can delay questions.
- Pause for 5 seconds after the cost center change and let the screen settle.
- If still no question after 30 seconds, proceed — the gap will appear during the debrief phase instead.

**If network is slow and the debrief map takes more than 10 seconds**:
- A loading indicator appears. Let it run. Do not click Start Debrief twice.
- The model call is to gpt-5-nano which is fast; slow responses are usually network latency.

**If the guardrail does not fire for the New Hire**:
- Check that the invoice amount is above 5,000 and the cost center is an OPEX code.
- The numeric threshold check in `tutor_service.py` is exact: `amount >= 5000` with `cost_center == OPEX-220`.
- Use EUR 6,200 and `OPEX-220` as shown above — those values are verified to trigger the block.
