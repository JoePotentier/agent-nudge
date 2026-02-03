#!/bin/bash
# Agent Nudge: Install Claude Code hooks
# This script adds the Agent Nudge hooks to your Claude Code settings

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOKS_DIR="$SCRIPT_DIR/hooks"
SETTINGS_FILE="$HOME/.claude/settings.json"

echo "Agent Nudge Hook Installer"
echo "=========================="
echo ""

# Check if hooks directory exists
if [ ! -d "$HOOKS_DIR" ]; then
    echo "Error: Hooks directory not found at $HOOKS_DIR"
    exit 1
fi

# Create .claude directory if it doesn't exist
if [ ! -d "$HOME/.claude" ]; then
    echo "Creating ~/.claude directory..."
    mkdir -p "$HOME/.claude"
fi

# Create settings file if it doesn't exist
if [ ! -f "$SETTINGS_FILE" ]; then
    echo "Creating new settings file..."
    echo '{}' > "$SETTINGS_FILE"
fi

# Check if jq is available
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed."
    echo ""
    echo "Install it with:"
    echo "  macOS:  brew install jq"
    echo "  Ubuntu: sudo apt-get install jq"
    exit 1
fi

# Read current settings
CURRENT_SETTINGS=$(cat "$SETTINGS_FILE")

# Check if settings is valid JSON
if ! echo "$CURRENT_SETTINGS" | jq . > /dev/null 2>&1; then
    echo "Error: $SETTINGS_FILE contains invalid JSON"
    exit 1
fi

# Create the hook commands
START_HOOK="$HOOKS_DIR/start-work.sh"
STOP_HOOK="$HOOKS_DIR/stop-work.sh"
EXIT_HOOK="$HOOKS_DIR/exit.sh"

# Build the new hooks configuration
# Use UserPromptSubmit to signal work starts when user sends a message (before Claude thinks)
# Use Stop to signal when Claude finishes and needs attention
# Use SessionEnd to unregister instance when session ends (including /exit)
NEW_SETTINGS=$(echo "$CURRENT_SETTINGS" | jq --arg start "$START_HOOK" --arg stop "$STOP_HOOK" --arg exit "$EXIT_HOOK" '
  # Initialize hooks object if it does not exist
  .hooks //= {} |

  # Initialize UserPromptSubmit array if it does not exist (fires when user submits prompt)
  .hooks.UserPromptSubmit //= [] |

  # Initialize Stop array if it does not exist
  .hooks.Stop //= [] |

  # Initialize Notification array if it does not exist
  .hooks.Notification //= [] |

  # Initialize SessionEnd array if it does not exist (fires when session ends)
  .hooks.SessionEnd //= [] |

  # Check if start hook already exists in UserPromptSubmit
  (if (.hooks.UserPromptSubmit | map(.hooks // [] | map(.command) | .[]) | index($start))
   then .
   else .hooks.UserPromptSubmit += [{"hooks": [{"type": "command", "command": $start}]}]
   end) |

  # Check if stop hook already exists (search in nested hooks arrays)
  (if (.hooks.Stop | map(.hooks // [] | map(.command) | .[]) | index($stop))
   then .
   else .hooks.Stop += [{"hooks": [{"type": "command", "command": $stop}]}]
   end) |

  # Check if notification hook already exists (search in nested hooks arrays)
  (if (.hooks.Notification | map(.hooks // [] | map(.command) | .[]) | index($stop))
   then .
   else .hooks.Notification += [{"hooks": [{"type": "command", "command": $stop}]}]
   end) |

  # Check if exit hook already exists in SessionEnd
  (if (.hooks.SessionEnd | map(.hooks // [] | map(.command) | .[]) | index($exit))
   then .
   else .hooks.SessionEnd += [{"hooks": [{"type": "command", "command": $exit}]}]
   end)
')

# Backup current settings
BACKUP_FILE="$SETTINGS_FILE.backup.$(date +%Y%m%d_%H%M%S)"
cp "$SETTINGS_FILE" "$BACKUP_FILE"
echo "Backed up current settings to: $BACKUP_FILE"

# Write new settings
echo "$NEW_SETTINGS" > "$SETTINGS_FILE"

echo ""
echo "Hooks installed successfully!"
echo ""
echo "Added to UserPromptSubmit: $START_HOOK"
echo "Added to Stop:             $STOP_HOOK"
echo "Added to Notification:     $STOP_HOOK"
echo "Added to SessionEnd:       $EXIT_HOOK"
echo ""
echo "Your Claude Code settings have been updated."
echo "Restart Claude Code for changes to take effect."
