#!/bin/bash
# Refocus: Unregister instance when Claude Code exits
# Triggered by SessionEnd hook (fires when session ends, including /exit)

# Use CLAUDE_SESSION_ID if available, otherwise use PWD as unique identifier
INSTANCE_ID="${CLAUDE_SESSION_ID:-$PWD}"

curl -s -X POST http://localhost:9999/api/unregister \
  -H "Content-Type: application/json" \
  -d "{\"instanceId\": \"$INSTANCE_ID\"}" \
  > /dev/null 2>&1

exit 0
