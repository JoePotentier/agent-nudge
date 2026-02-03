#!/bin/bash
# Refocus: Signal that Claude started working
# Triggered by UserPromptSubmit hook (fires when user sends a message)

# Use CLAUDE_SESSION_ID if available, otherwise use PWD as unique identifier
INSTANCE_ID="${CLAUDE_SESSION_ID:-$PWD}"
PROJECT_NAME="$(basename "$PWD")"

curl -s -X POST http://localhost:9999/api/start \
  -H "Content-Type: application/json" \
  -d "{\"instanceId\": \"$INSTANCE_ID\", \"name\": \"$PROJECT_NAME\"}" \
  > /dev/null 2>&1

exit 0
