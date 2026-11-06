#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$PROJECT_DIR"
if command -v uv >/dev/null 2>&1; then
  if [[ ! -x .venv/bin/python ]]; then uv venv --python 3.12 .venv; fi
  uv pip install --python .venv/bin/python -r requirements-dev.lock.txt
else
  if [[ ! -x .venv/bin/python ]]; then python3.12 -m venv .venv; fi
  .venv/bin/python -m pip install -r requirements-dev.lock.txt
fi
npm --prefix frontend ci
npm --prefix frontend run build
printf '\nTerraLens is installed. Start it with ./scripts/start.sh\n'
