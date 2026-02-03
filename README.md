# Refocus

A Chrome extension that displays an attention-grabbing overlay on distracting websites when Claude needs your input.

## Features

- **Overlay, not blocking** - Sites remain fully functional; an overlay appears on top
- **Real-time** - Overlay appears/disappears instantly based on Claude's status
- **Non-disruptive** - Videos keep playing, content loads normally
- **Attention-grabbing** - Prominent visual indicator to bring you back to work

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        REFOCUS SYSTEM                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐     HTTP Poll      ┌──────────────────┐  │
│  │ Chrome Extension │ ◄─────────────────► │  Status Server   │  │
│  │ (Content Script) │    (every 2s)      │  (localhost:9999)│  │
│  └──────────────────┘                     └──────────────────┘  │
│           │                                        ▲            │
│           │ Injects overlay                        │            │
│           ▼                                        │            │
│  ┌──────────────────┐                    ┌──────────────────┐  │
│  │  Watched Sites   │                    │   Claude Code    │  │
│  │  - YouTube       │                    │     Hooks        │  │
│  │  - Twitter/X     │                    │  (signals status)│  │
│  │  - Reddit        │                    └──────────────────┘  │
│  │  - (configurable)│                                          │
│  └──────────────────┘                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
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

The server runs on `http://localhost:9999`.

### 2. Install the Chrome Extension

1. Open Chrome and navigate to `chrome://extensions`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `extension/` folder
5. The Refocus icon should appear in your toolbar

### 3. Configure Claude Code Hooks

**Automatic installation:**
```bash
./install-hooks.sh
```

**Manual installation:** Add the following to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "hooks": [{"type": "command", "command": "/path/to/refocus/hooks/start-work.sh"}]
      }
    ],
    "Stop": [
      {
        "hooks": [{"type": "command", "command": "/path/to/refocus/hooks/stop-work.sh"}]
      }
    ]
  }
}
```

Replace `/path/to/refocus` with the actual path to this project.

## Default Watched Sites

The overlay appears on these sites when Claude needs attention:

- youtube.com
- twitter.com / x.com
- reddit.com
- facebook.com
- instagram.com
- tiktok.com
- twitch.tv

You can configure these in the extension popup.

## Usage

1. Start the status server: `npm start`
2. Use Claude Code normally
3. When you switch to a distracting site while Claude is waiting for input, you'll see the overlay
4. When Claude is actively working, the overlay disappears

### Extension Popup

Click the extension icon to:
- Toggle the extension on/off
- See current Claude status (Working/Needs Attention)
- Dismiss the overlay temporarily (5, 15, or 30 minutes)
- View server connection status

## Testing

### Test Server Endpoints

```bash
# Check status
curl http://localhost:9999/api/status

# Simulate Claude starting work (hides overlay)
curl -X POST http://localhost:9999/api/start

# Simulate Claude stopping (shows overlay)
curl -X POST http://localhost:9999/api/stop

# Send heartbeat
curl -X POST http://localhost:9999/api/heartbeat
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

If no heartbeat is received for 60 seconds while Claude is marked as active, the server automatically transitions to "needs attention" state, showing the overlay.

## Troubleshooting

### Overlay not appearing

1. Check if the server is running: `curl http://localhost:9999/health`
2. Check the extension is enabled in `chrome://extensions`
3. Make sure you're on a watched site
4. Check the browser console for errors

### Server connection issues

1. Make sure the server is running on port 9999
2. Check for firewall or proxy issues
3. Verify CORS is working (check browser console)

### Extension not loading

1. Make sure Developer Mode is enabled in Chrome
2. Check for errors in the extension card on `chrome://extensions`
3. Try reloading the extension

## Project Structure

```
refocus/
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
├── hooks/                  # Claude Code integration
│   ├── start-work.sh       # Signal work started
│   └── stop-work.sh        # Signal work stopped
├── install-hooks.sh        # Auto-install Claude hooks
├── install-service.sh      # Install as macOS service
├── uninstall-service.sh    # Remove macOS service
├── com.refocus.server.plist # macOS launchd template
├── package.json            # Root package
└── README.md               # This file
```

## License

MIT
