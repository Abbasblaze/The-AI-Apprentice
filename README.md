# The AI Apprentice

## Setup

### API

```bash
cd api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add OPENAI_API_KEY and ELEVENLABS_* keys
```

### Web

```bash
cd web
npm install
cp .env.local.example .env.local
```

## Run

**API** (port 8000):
```bash
cd api
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```

**Web** (port 3000):
```bash
cd web
npm run dev
```

Open http://localhost:3000

## Routes

The app has two modes accessed from the home page:

| Route | Description |
|---|---|
| `/` | Home — choose Expert or Learner |
| `/expert` | Expert capture (screen share + voice) |
| `/expert/sessions` | Expert session list |
| `/expert/sessions/[id]` | Session detail, timeline, snapshots |
| `/expert/sessions/[id]/debrief` | AI-guided debrief |
| `/expert/sessions/[id]/map` | Work map viewer + export |
| `/expert/sessions/[id]/privacy` | Privacy / redaction / delete |
| `/learn` | Learner — choose a confirmed Work Map |
| `/learn/[mapId]` | Active tutoring session |
| `/learn/sessions` | Past tutor sessions |
| `/erp` | ERP simulator (expert: `?set=expert`, learner: `?set=newhire&tutor=<id>`) |
| `/demo` | Demo checklist |

Old `/sessions` and `/tutor` routes redirect permanently to the new paths.

## Test

**API tests:**
```bash
cd api
source .venv/bin/activate
pytest
```

**Web tests and type checks:**
```bash
cd web
npm run test
npm run typecheck
npm run lint
```

## Demo

Open http://localhost:3000/demo for the step-by-step demo checklist with live status checks.

**Reset demo data** (clears tutor sessions, keeps confirmed maps):
```bash
./scripts/reset_demo.sh
```

See [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) for the 4-minute demo script.
