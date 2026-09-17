@echo off
setlocal
cd /d "%~dp0"
call npm run local:start
set "exitCode=%errorlevel%"
if not "%exitCode%"=="0" pause
exit /b %exitCode%
