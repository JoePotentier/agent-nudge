#!/bin/bash
# Agent Nudge: Unregister instance when Claude Code exits
# Triggered by SessionEnd hook (fires when session ends, including /exit)

# Configurable port (default: 9999)
PORT="${AGENT_NUDGE_PORT:-9999}"

# Use CLAUDE_SESSION_ID if available, otherwise use PWD as unique identifier
INSTANCE_ID="${CLAUDE_SESSION_ID:-$PWD}"

curl -s -X POST "http://localhost:${PORT}/api/unregister" \
  -H "Content-Type: application/json" \
  -d "{\"instanceId\": \"$INSTANCE_ID\"}" \
  > /dev/null 2>&1

exit 0
