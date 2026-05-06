#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
HOST="${HOST:-127.0.0.1}"

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  if [[ -n "${FRONTEND_PID}" ]] && kill -0 "${FRONTEND_PID}" 2>/dev/null; then
    kill "${FRONTEND_PID}" 2>/dev/null || true
  fi
  if [[ -n "${BACKEND_PID}" ]] && kill -0 "${BACKEND_PID}" 2>/dev/null; then
    kill "${BACKEND_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_command npm
require_command python3

if [[ ! -d "${ROOT_DIR}/frontend/node_modules" ]]; then
  echo "Installing frontend dependencies..."
  npm install --prefix "${ROOT_DIR}/frontend"
fi

if ! PYTHONPATH="${ROOT_DIR}/backend" python3 - <<'PY' >/dev/null 2>&1
import fastapi
import uvicorn
import sqlalchemy
PY
then
  echo "Installing backend dependencies..."
  python3 -m pip install -r "${ROOT_DIR}/backend/requirements.txt"
fi

export PYTHONPATH="${ROOT_DIR}/backend:${PYTHONPATH:-}"

echo "Starting SIFT backend on http://${HOST}:${BACKEND_PORT}"
(
  cd "${ROOT_DIR}/backend"
  python3 -m uvicorn app.main:app --reload --host "${HOST}" --port "${BACKEND_PORT}"
) &
BACKEND_PID="$!"

echo "Starting SIFT frontend on http://${HOST}:${FRONTEND_PORT}"
(
  cd "${ROOT_DIR}/frontend"
  ./node_modules/.bin/next dev -H "${HOST}" -p "${FRONTEND_PORT}"
) &
FRONTEND_PID="$!"

echo
echo "SIFT is running:"
echo "  Frontend: http://${HOST}:${FRONTEND_PORT}"
echo "  Backend:  http://${HOST}:${BACKEND_PORT}"
echo
echo "Press Ctrl+C to stop both servers."

wait "${FRONTEND_PID}"
