#!/bin/bash
# Refocus: Uninstall macOS launchd service

PLIST="$HOME/Library/LaunchAgents/com.refocus.server.plist"

echo "Refocus Service Uninstaller"
echo "==========================="
echo ""

if [ -f "$PLIST" ]; then
    echo "Stopping and removing service..."
    launchctl unload "$PLIST" 2>/dev/null || true
    rm "$PLIST"
    echo "Service removed."
else
    echo "Service not installed."
fi
