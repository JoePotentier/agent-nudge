#!/bin/bash
# Agent Nudge: Signal that agent stopped and needs attention
# Triggered by Stop hook (fires when Claude finishes responding)

# Configurable port (default: 9999)
PORT="${AGENT_NUDGE_PORT:-9999}"

# Use CLAUDE_SESSION_ID if available, otherwise use PWD as unique identifier
INSTANCE_ID="${CLAUDE_SESSION_ID:-$PWD}"
PROJECT_NAME="$(basename "$PWD")"

curl -s -X POST "http://localhost:${PORT}/api/stop" \
  -H "Content-Type: application/json" \
  -d "{\"instanceId\": \"$INSTANCE_ID\", \"name\": \"$PROJECT_NAME\", \"source\": \"claude-code\"}" \
  > /dev/null 2>&1

exit 0
