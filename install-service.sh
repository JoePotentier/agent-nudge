#!/bin/bash
# Refocus: Install as macOS launchd service
# This script sets up the Refocus server to run automatically on login

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/server"
PLIST_TEMPLATE="$SCRIPT_DIR/com.refocus.server.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/com.refocus.server.plist"
NODE_PATH=$(which node)

echo "Refocus Service Installer"
echo "========================="
echo ""

# Check if node is installed
if [ -z "$NODE_PATH" ]; then
    echo "Error: Node.js not found in PATH"
    exit 1
fi

echo "Using Node.js: $NODE_PATH"
echo "Server path:   $SERVER_DIR"
echo ""

# Create LaunchAgents directory if needed
mkdir -p "$HOME/Library/LaunchAgents"

# Stop existing service if running
if launchctl list | grep -q "com.refocus.server"; then
    echo "Stopping existing service..."
    launchctl unload "$PLIST_DEST" 2>/dev/null || true
fi

# Create plist from template
sed -e "s|__SERVER_PATH__|$SERVER_DIR|g" \
    -e "s|/usr/local/bin/node|$NODE_PATH|g" \
    "$PLIST_TEMPLATE" > "$PLIST_DEST"

# Load the service
launchctl load "$PLIST_DEST"

echo "Service installed and started!"
echo ""
echo "Commands:"
echo "  Start:   launchctl load ~/Library/LaunchAgents/com.refocus.server.plist"
echo "  Stop:    launchctl unload ~/Library/LaunchAgents/com.refocus.server.plist"
echo "  Logs:    tail -f $SERVER_DIR/refocus.log"
echo ""
echo "The server will now start automatically when you log in."
