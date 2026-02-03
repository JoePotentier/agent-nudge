# Refocus Status Server

A lightweight local server that tracks Claude's working status.

## Quick Start

```bash
npm install
npm start
```

The server runs on `http://localhost:9999`.

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Returns current status (`isActive`, `lastActivity`) |
| `/api/start` | POST | Signal that Claude started working |
| `/api/stop` | POST | Signal that Claude stopped and needs attention |
| `/api/heartbeat` | POST | Keep session alive during long operations |
| `/health` | GET | Health check endpoint |

## Timeout Behavior

If no heartbeat is received for 60 seconds while in active state, the server automatically transitions to inactive (needs attention).

## Testing

```bash
# Check status
curl http://localhost:9999/api/status

# Start working
curl -X POST http://localhost:9999/api/start

# Stop working
curl -X POST http://localhost:9999/api/stop

# Send heartbeat
curl -X POST http://localhost:9999/api/heartbeat
```
