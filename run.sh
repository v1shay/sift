#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
HOST="${HOST:-127.0.0.1}"
OPEN_BROWSER="${OPEN_BROWSER:-1}"
FRONTEND_URL="http://${HOST}:${FRONTEND_PORT}"
BACKEND_URL="http://${HOST}:${BACKEND_PORT}"

BACKEND_PID=""
FRONTEND_PID=""
OPENER_PID=""

cleanup() {
  if [[ -n "${OPENER_PID}" ]] && kill -0 "${OPENER_PID}" 2>/dev/null; then
    kill "${OPENER_PID}" 2>/dev/null || true
  fi
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

open_url() {
  local url="$1"
  if command -v open >/dev/null 2>&1; then
    open "$url"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" >/dev/null 2>&1 &
  elif command -v start >/dev/null 2>&1; then
    start "$url"
  else
    echo "Open this URL in your browser: $url"
  fi
}

wait_for_frontend_and_open() {
  if [[ "${OPEN_BROWSER}" == "0" || "${OPEN_BROWSER}" == "false" ]]; then
    return
  fi

  for _ in {1..60}; do
    if curl -fsS "${FRONTEND_URL}" >/dev/null 2>&1; then
      echo "Opening SIFT in your browser..."
      open_url "${FRONTEND_URL}"
      return
    fi
    sleep 1
  done

  echo "SIFT is still starting. Open this URL when it is ready: ${FRONTEND_URL}"
}

if [[ ! -d "${ROOT_DIR}/frontend/node_modules" ]]; then
  echo "Installing frontend dependencies..."
  npm install --prefix "${ROOT_DIR}/frontend"
fi

PYTHON_CMD="python3"
if [[ -f "${ROOT_DIR}/backend/venv/bin/python3" ]]; then
  PYTHON_CMD="${ROOT_DIR}/backend/venv/bin/python3"
fi

if ! PYTHONPATH="${ROOT_DIR}/backend" "${PYTHON_CMD}" - <<'PY' >/dev/null 2>&1
import fastapi
import uvicorn
import sqlalchemy
PY
then
  echo "Installing backend dependencies..."
  "${PYTHON_CMD}" -m pip install -r "${ROOT_DIR}/backend/requirements.txt"
fi

export PYTHONPATH="${ROOT_DIR}/backend:${PYTHONPATH:-}"

echo "Starting SIFT backend on ${BACKEND_URL}"
(
  cd "${ROOT_DIR}/backend"
  "${PYTHON_CMD}" -m uvicorn app.main:app --reload --host "${HOST}" --port "${BACKEND_PORT}"
) &
BACKEND_PID="$!"

echo "Starting SIFT frontend on ${FRONTEND_URL}"
(
  cd "${ROOT_DIR}/frontend"
  ./node_modules/.bin/next dev -H "${HOST}" -p "${FRONTEND_PORT}"
) &
FRONTEND_PID="$!"

wait_for_frontend_and_open &
OPENER_PID="$!"

echo
echo "SIFT is running:"
echo "  Frontend: ${FRONTEND_URL}"
echo "  Backend:  ${BACKEND_URL}"
echo
echo "Press Ctrl+C to stop both servers."
echo "Set OPEN_BROWSER=0 to start without opening a browser."

wait "${FRONTEND_PID}"
