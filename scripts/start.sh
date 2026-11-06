#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$PROJECT_DIR"
if [[ ! -x .venv/bin/python ]]; then
  printf 'Run ./scripts/setup.sh first.\n' >&2
  exit 1
fi
if [[ ! -f frontend/dist/index.html ]]; then
  npm --prefix frontend run build
fi
export PYTHONPATH="$PROJECT_DIR/backend${PYTHONPATH:+:$PYTHONPATH}"
export OMP_NUM_THREADS=2 OPENBLAS_NUM_THREADS=2 MKL_NUM_THREADS=2
exec .venv/bin/python -m uvicorn terralens.app:app --host 127.0.0.1 --port "${PORT:-8000}"
