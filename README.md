# The AI Apprentice

## Setup

### API

```bash
cd api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
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

## Lint and typecheck

```bash
cd web && npm run lint && npm run typecheck
```
