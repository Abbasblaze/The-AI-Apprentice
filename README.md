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
