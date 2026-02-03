@echo off
REM Agent Nudge: Signal that agent started working
REM Triggered by UserPromptSubmit hook (fires when user sends a message)

REM Configurable port (default: 9999)
set PORT=%AGENT_NUDGE_PORT%
if "%PORT%"=="" set PORT=9999

REM Use CLAUDE_SESSION_ID if available, otherwise use current directory
set INSTANCE_ID=%CLAUDE_SESSION_ID%
if "%INSTANCE_ID%"=="" set INSTANCE_ID=%CD%

REM Get project name from current directory
for %%I in (.) do set PROJECT_NAME=%%~nxI

curl -s -X POST "http://localhost:%PORT%/api/start" -H "Content-Type: application/json" -d "{\"instanceId\": \"%INSTANCE_ID%\", \"name\": \"%PROJECT_NAME%\", \"source\": \"claude-code\"}" >nul 2>&1

exit /b 0
