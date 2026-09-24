@echo off
setlocal
cd /d "%~dp0"
call npm run local:start
set "exitCode=%errorlevel%"
echo.
if "%exitCode%"=="0" (
  echo [moodlelike] Command completed successfully. Press any key to close this window.
) else (
  echo [moodlelike] Startup failed with exit code %exitCode%. Keep the error details above for troubleshooting.
)
pause >nul
exit /b %exitCode%
