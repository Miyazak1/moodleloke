$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path $root "frontend"

$env:PORT = "3100"
$env:VITE_API_BASE_URL = "http://localhost:3100"
$env:VITE_STANDALONE_AGENT = "1"
$env:AGENT_WEB_ENABLED = "true"
$env:VITE_AGENT_WEB_ENABLED = "true"
$env:CSCA_AGENT_FOUNDATION_ENABLED = "true"
$env:CSCA_LEARNING_EVIDENCE_WRITE_ENABLED = "true"
$env:CSCA_LEARNING_SHADOW_PROJECTION_ENABLED = "true"
$env:CSCA_TARGET_GAP_ENABLED = "true"
$env:CSCA_LEARNING_PRESCRIPTION_ENABLED = "true"
$env:CSCA_AGENT_PRACTICE_WRITE_ENABLED = "true"
$env:CSCA_AGENT_TEACHING_ASSET_ENABLED = "true"

Write-Host "Starting Moodlelike Agent backend on http://localhost:3100 ..."
Start-Process powershell -WindowStyle Hidden -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-Command", "$env:PORT='3100'; Set-Location '$root'; npm run backend:dev"
)

Write-Host "Starting Moodlelike Agent frontend on http://localhost:5190 ..."
Start-Process powershell -WindowStyle Hidden -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-Command", "$env:VITE_API_BASE_URL='http://localhost:3100'; $env:VITE_STANDALONE_AGENT='1'; $env:VITE_AGENT_WEB_ENABLED='true'; Set-Location '$frontend'; npm run dev:force -- --port 5190"
)

Write-Host "Agent services launched. Open http://localhost:5190/zh/agent"
