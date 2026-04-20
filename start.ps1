# Start the Finance Dashboard (backend + frontend)

$Root = $PSScriptRoot

# Start FastAPI backend
$backend = Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "cd '$Root\backend'; .\venv\Scripts\Activate.ps1; uvicorn app.main:app --reload"
) -PassThru

# Start Next.js frontend
$frontend = Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "cd '$Root\frontend'; npm run dev"
) -PassThru

Write-Host ""
Write-Host "Finance Dashboard started:"
Write-Host "  Backend  -> http://localhost:8000"
Write-Host "  Frontend -> http://localhost:3000"
Write-Host ""
Write-Host "Close the terminal windows to stop the servers."
