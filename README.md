# Agent Nudge

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](package.json)

A Chrome extension that displays an attention-grabbing overlay on distracting websites when your AI agent needs your input. Works with Claude Code, and any tool that can make HTTP requests.

## Features

- **Non-blocking overlay** - Sites remain fully functional; an overlay appears on top
- **Real-time updates** - Overlay appears/disappears instantly based on agent status
- **Multi-instance support** - Track multiple agent sessions simultaneously
- **Configurable sites** - Add or remove watched sites via the popup UI
- **Configurable port** - Use any port for the status server
- **Generic webhook API** - Integrate with any AI tool or automation
- **Cross-platform** - Works on macOS, Linux, and Windows

## How It Works

```
┌──────────────────────────────────────────────────────────────────┐
│                      AGENT NUDGE SYSTEM                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐     HTTP Poll      ┌──────────────────┐   │
│  │ Chrome Extension │ ◄─────────────────► │  Status Server   │   │
│  │ (Content Script) │    (every 2s)      │  (localhost:9999)│   │
│  └──────────────────┘                     └──────────────────┘   │
│           │                                        ▲             │
│           │ Injects overlay                        │             │
│           ▼                                        │             │
│  ┌──────────────────┐                    ┌──────────────────┐   │
│  │  Watched Sites   │                    │   Any AI Agent   │   │
│  │  (configurable)  │                    │   - Claude Code  │   │
│  │                  │                    │   - Custom tools │   │
│  └──────────────────┘                    │   - Automations  │   │
│                                          └──────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Installation

### 1. Install the Status Server

```bash
cd server
npm install
```

**Run in foreground (for testing):**
```bash
npm start
```

**Run in background:**
```bash
npm run start:bg    # Start in background
npm run status      # Check if running
npm run logs        # View logs
npm run stop        # Stop server
```

**Run as macOS service (auto-starts on login):**
```bash
./install-service.sh    # Install and start
./uninstall-service.sh  # Remove service
```

The server runs on `http://localhost:9999` by default.

### 2. Install the Chrome Extension

1. Open Chrome and navigate to `chrome://extensions`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `extension/` folder
5. The Agent Nudge icon should appear in your toolbar

### 3. Configure Claude Code Hooks (Optional)

If using with Claude Code:

**Automatic installation:**
```bash
./install-hooks.sh
```

**Manual installation:** Add the following to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [{"type": "command", "command": "/path/to/agent-nudge/hooks/start-work.sh"}]
      }
    ],
    "PreToolUse": [
      {
        "hooks": [{"type": "command", "command": "/path/to/agent-nudge/hooks/start-work.sh"}]
      }
    ],
    "Stop": [
      {
        "hooks": [{"type": "command", "command": "/path/to/agent-nudge/hooks/stop-work.sh"}]
      }
    ]
  }
}
```

Replace `/path/to/agent-nudge` with the actual path to this project.

## Configuration

### Server Port

Set a custom port using the `AGENT_NUDGE_PORT` environment variable:

```bash
# Start server on custom port
AGENT_NUDGE_PORT=8888 npm start
```

Or create a `.env` file (copy from `.env.example`):
```
AGENT_NUDGE_PORT=8888
```

Update the port in the extension popup to match.

### Watched Sites

Configure which sites show the overlay via the extension popup:

1. Click the Agent Nudge icon in Chrome
2. Use the "Watched Sites" section to add/remove sites
3. Click "Reset to Defaults" to restore the default list

**Default sites:**
- youtube.com
- twitter.com / x.com
- reddit.com
- facebook.com
- instagram.com
- tiktok.com
- twitch.tv

## Generic Integration (Any Tool)

Agent Nudge works with any tool that can make HTTP requests. Use the simple webhook API to signal when your agent/tool starts and stops working.

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/start` | POST | Signal agent started working |
| `/api/stop` | POST | Signal agent stopped (needs attention) |
| `/api/heartbeat` | POST | Keep session alive |
| `/api/status` | GET | Get current status |
| `/api/unregister` | POST | Remove an instance |
| `/health` | GET | Health check |

### Example: curl

```bash
# Signal work started (hides overlay)
curl -X POST http://localhost:9999/api/start \
  -H "Content-Type: application/json" \
  -d '{"instanceId": "my-tool", "name": "My Custom Tool", "source": "my-tool"}'

# Signal work stopped (shows overlay)
curl -X POST http://localhost:9999/api/stop \
  -H "Content-Type: application/json" \
  -d '{"instanceId": "my-tool", "source": "my-tool"}'

# Check status
curl http://localhost:9999/api/status

# Remove instance when done
curl -X POST http://localhost:9999/api/unregister \
  -H "Content-Type: application/json" \
  -d '{"instanceId": "my-tool"}'
```

### Example: Python

```python
import requests

BASE_URL = "http://localhost:9999"

def start_work(instance_id, name="My Agent"):
    requests.post(f"{BASE_URL}/api/start", json={
        "instanceId": instance_id,
        "name": name,
        "source": "python-agent"
    })

def stop_work(instance_id):
    requests.post(f"{BASE_URL}/api/stop", json={
        "instanceId": instance_id,
        "source": "python-agent"
    })

# Usage
start_work("session-123", "Data Processing")
# ... do work ...
stop_work("session-123")
```

### Example: Node.js

```javascript
const BASE_URL = 'http://localhost:9999';

async function startWork(instanceId, name = 'My Agent') {
  await fetch(`${BASE_URL}/api/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instanceId, name, source: 'node-agent' })
  });
}

async function stopWork(instanceId) {
  await fetch(`${BASE_URL}/api/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instanceId, source: 'node-agent' })
  });
}
```

## Windows Setup

For Windows users, use the `.bat` hook files instead of `.sh`:

1. Configure Claude Code hooks to use the Windows batch files:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [{"type": "command", "command": "C:\\path\\to\\agent-nudge\\hooks\\start-work.bat"}]
      }
    ],
    "PreToolUse": [
      {
        "hooks": [{"type": "command", "command": "C:\\path\\to\\agent-nudge\\hooks\\start-work.bat"}]
      }
    ],
    "Stop": [
      {
        "hooks": [{"type": "command", "command": "C:\\path\\to\\agent-nudge\\hooks\\stop-work.bat"}]
      }
    ]
  }
}
```

2. Set the port via environment variable (optional):
```cmd
set AGENT_NUDGE_PORT=8888
```

## Extension Popup

Click the extension icon to:
- Toggle the extension on/off
- Configure the server port
- See current agent status (Working/Needs Attention)
- View active instance count
- Dismiss the overlay temporarily (5, 15, or 30 minutes)
- Manage watched sites

## Testing

### Test Server Endpoints

```bash
# Check status
curl http://localhost:9999/api/status

# Simulate agent starting work (hides overlay)
curl -X POST http://localhost:9999/api/start \
  -H "Content-Type: application/json" \
  -d '{"source": "test"}'

# Simulate agent stopping (shows overlay)
curl -X POST http://localhost:9999/api/stop \
  -H "Content-Type: application/json" \
  -d '{"source": "test"}'
```

### Test Overlay

1. Start the server: `npm start`
2. Load the extension in Chrome
3. Open YouTube and start a video
4. Run `curl -X POST http://localhost:9999/api/stop`
5. The overlay should appear (video keeps playing)
6. Run `curl -X POST http://localhost:9999/api/start`
7. The overlay should disappear within 2 seconds

## Timeout Behavior

If no heartbeat is received for 5 minutes while an agent is marked as active, the server automatically transitions to "needs attention" state, showing the overlay.

## Troubleshooting

### Overlay not appearing

1. Check if the server is running: `curl http://localhost:9999/health`
2. Check the extension is enabled in `chrome://extensions`
3. Make sure the site is in your watched sites list
4. Verify the port matches between server and extension
5. Check the browser console for errors

### Server connection issues

1. Make sure the server is running on the correct port
2. Check for firewall or proxy issues
3. Verify CORS is working (check browser console)

### Extension not loading

1. Make sure Developer Mode is enabled in Chrome
2. Check for errors in the extension card on `chrome://extensions`
3. Try reloading the extension

## Project Structure

```
agent-nudge/
├── extension/              # Chrome Extension
│   ├── manifest.json       # Extension manifest (V3)
│   ├── background.js       # Service worker - polls status
│   ├── content.js          # Injected into sites - shows overlay
│   ├── content.css         # Overlay styling
│   ├── popup.html          # Extension popup UI
│   ├── popup.js            # Popup logic
│   ├── popup.css           # Popup styling
│   └── icons/              # Extension icons
├── server/                 # Local Status Server
│   ├── package.json
│   ├── server.js           # Express server
│   └── README.md
├── hooks/                  # Agent integration hooks
│   ├── start-work.sh       # macOS/Linux: Signal work started
│   ├── stop-work.sh        # macOS/Linux: Signal work stopped
│   ├── exit.sh             # macOS/Linux: Unregister on exit
│   ├── start-work.bat      # Windows: Signal work started
│   ├── stop-work.bat       # Windows: Signal work stopped
│   └── exit.bat            # Windows: Unregister on exit
├── install-hooks.sh        # Auto-install Claude hooks
├── install-service.sh      # Install as macOS service
├── uninstall-service.sh    # Remove macOS service
├── .env.example            # Environment configuration template
├── package.json            # Root package
├── LICENSE                 # MIT License
└── README.md               # This file
```

## License

MIT
