People First, Then Agents

The same Work Map that teaches a new hire can govern an agent doing the same task.

---

Where we are today

The Apprentice watches an expert, builds a map of their decisions and guardrails,
confirms it with them, then teaches a new hire — blocking mistakes in real time.

The map is already machine-readable.
GET /sessions/{id}/map/export?format=markdown returns the steps, hard stops,
and "stop and ask a person" rules as structured text.

The guardrails that block a new hire are the same rules that should block an agent.

---

The path

Step 1 (done): Capture. Expert does the task. Apprentice extracts steps and guardrails.
Map is confirmed by the expert.

Step 2 (done): Teach. New hire is tested against the map. Guardrail judge blocks violations.
Mastery is measured.

Step 3 (next): Route. Hand routine steps to an agent using the exported map as its
operating rules. People keep the judgment calls — every step marked is_judgment_call=true
is held for a human.

Step 4: Audit. Every agent action is checked against the same guardrails as the new hire.
Blocks, overrides, and escalations are logged. The map owner sees what the agent did
and why it stopped.

Step 5: Improve. When an agent hits an unhandled case, it becomes a gap in the map.
The next expert session fills that gap. The map gets sharper over time.

---

What this is not

Not autonomous AI taking over processes.
Not a rules engine that someone hard-codes by hand.
Not a system that works without an expert signing off first.

The expert confirms the map before anyone — human or agent — uses it.
The "confirmed by the expert" flag is a hard gate in the export endpoint.
A map without expert confirmation cannot be exported.

---

One concrete claim

Today, the EUR 5,000 capex/opex guardrail in the demo is checked by a numeric
threshold in the code (tutor_service.py, _numeric_verdict). That same check
could run on an AP automation agent processing a hundred invoices a night.
Every invoice above the threshold that the agent tries to post to OPEX gets blocked —
and a human gets the escalation.

The guard came from Sabine's words, verified by Sabine.
No one had to write a policy document or maintain a rules spreadsheet.

---

The bet

If you can capture a person's judgment accurately enough to teach another person,
you have captured it accurately enough to constrain an agent.
The hard part is the capture — and that is what this project solves.
