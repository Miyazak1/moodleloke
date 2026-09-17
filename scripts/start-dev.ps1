$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path $root "frontend"

Write-Host "Starting CSCAlite backend on http://localhost:3000 ..."
Start-Process powershell -WindowStyle Hidden -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-Command", "Set-Location '$root'; npm run backend:dev"
)

Write-Host "Starting CSCAlite frontend on http://localhost:5174 ..."
Start-Process powershell -WindowStyle Hidden -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-Command", "Set-Location '$frontend'; npm run dev:force -- --port 5174"
)

Write-Host "Dev services launched. Open http://localhost:5174"
