@echo off
REM Agent Nudge: Unregister instance when Claude Code exits
REM Triggered by SessionEnd hook (fires when session ends, including /exit)

REM Configurable port (default: 9999)
set PORT=%AGENT_NUDGE_PORT%
if "%PORT%"=="" set PORT=9999

REM Use CLAUDE_SESSION_ID if available, otherwise use current directory
set INSTANCE_ID=%CLAUDE_SESSION_ID%
if "%INSTANCE_ID%"=="" set INSTANCE_ID=%CD%

curl -s -X POST "http://localhost:%PORT%/api/unregister" -H "Content-Type: application/json" -d "{\"instanceId\": \"%INSTANCE_ID%\"}" >nul 2>&1

exit /b 0
