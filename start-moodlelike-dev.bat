@echo off
setlocal
cd /d "%~dp0"
set "PORT=3100"
set "VITE_API_BASE_URL=http://localhost:3100"
set "VITE_STANDALONE_AGENT=1"
set "AGENT_WEB_ENABLED=true"
set "VITE_AGENT_WEB_ENABLED=true"
set "CSCA_AGENT_FOUNDATION_ENABLED=true"
set "CSCA_LEARNING_EVIDENCE_WRITE_ENABLED=true"
set "CSCA_LEARNING_SHADOW_PROJECTION_ENABLED=true"
set "CSCA_TARGET_GAP_ENABLED=true"
set "CSCA_LEARNING_PRESCRIPTION_ENABLED=true"
set "CSCA_AGENT_PRACTICE_WRITE_ENABLED=true"
set "CSCA_AGENT_TEACHING_ASSET_ENABLED=true"

echo Starting Moodlelike PostgreSQL...
docker compose up -d --wait postgres
if errorlevel 1 exit /b 1

call npm run db:migrate
if errorlevel 1 exit /b 1

start "Moodlelike Agent Backend" cmd /k "cd /d %~dp0 && npm run backend:dev"
node scriptswait-for-http.cjs http://localhost:3100/health 90000
if errorlevel 1 exit /b 1

start "Moodlelike Agent Frontend" cmd /k "cd /d %~dp0 && npm run frontend:dev"
node scriptswait-for-http.cjs http://localhost:5190/ 90000
if errorlevel 1 exit /b 1

echo Agent: http://localhost:5190/zh/agent
endlocal
