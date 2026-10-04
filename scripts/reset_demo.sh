#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SESSIONS_DIR="$REPO_ROOT/api/data/sessions"
TUTOR_DIR="$REPO_ROOT/api/data/tutor"

echo "Resetting demo data..."

if [ -d "$TUTOR_DIR" ]; then
  rm -rf "${TUTOR_DIR:?}"/*
  echo "  Cleared tutor sessions."
else
  echo "  No tutor data directory found — skipping."
fi

if [ -d "$SESSIONS_DIR" ]; then
  for session_dir in "$SESSIONS_DIR"/*/; do
    [ -d "$session_dir" ] || continue
    map_file="$session_dir/map.json"
    if [ -f "$map_file" ] && python3 -c "
import json, sys
data = json.load(open('$map_file'))
sys.exit(0 if data.get('expert_confirmed') else 1)
" 2>/dev/null; then
      echo "  Keeping confirmed map: $(basename "$session_dir")"
    else
      rm -rf "$session_dir"
      echo "  Removed session: $(basename "$session_dir")"
    fi
  done
else
  echo "  No sessions directory found — skipping."
fi

echo "Done. Confirmed maps kept; all other sessions and tutor data cleared."
