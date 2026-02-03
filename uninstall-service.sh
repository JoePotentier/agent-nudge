#!/bin/bash
# Agent Nudge: Uninstall macOS launchd service

PLIST="$HOME/Library/LaunchAgents/com.agent-nudge.server.plist"

echo "Agent Nudge Service Uninstaller"
echo "==============================="
echo ""

if [ -f "$PLIST" ]; then
    echo "Stopping and removing service..."
    launchctl unload "$PLIST" 2>/dev/null || true
    rm "$PLIST"
    echo "Service removed."
else
    echo "Service not installed."
fi
