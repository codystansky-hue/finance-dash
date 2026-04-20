#!/usr/bin/env bash
# Start the Finance Dashboard (backend + frontend)

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Activate Python venv and start FastAPI backend
(
  cd "$ROOT/backend"
  if [[ -f venv/Scripts/activate ]]; then
    source venv/Scripts/activate   # Windows / Git Bash
  else
    source venv/bin/activate       # macOS / Linux
  fi
  uvicorn app.main:app --reload
) &
BACKEND_PID=$!

# Start Next.js frontend
(
  cd "$ROOT/frontend"
  npm run dev
) &
FRONTEND_PID=$!

echo ""
echo "Finance Dashboard started:"
echo "  Backend  → http://localhost:8000"
echo "  Frontend → http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers."

# Shut down both processes on Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT INT TERM
wait $BACKEND_PID $FRONTEND_PID
