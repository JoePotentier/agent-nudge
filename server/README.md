# Agent Nudge Status Server

A lightweight local server that tracks AI agent working status.

## Quick Start

```bash
npm install
npm start
```

The server runs on `http://localhost:9999` by default.

## Configuration

Set a custom port using the `AGENT_NUDGE_PORT` environment variable:

```bash
AGENT_NUDGE_PORT=8888 npm start
```

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Returns current status for all instances |
| `/api/start` | POST | Signal that agent started working |
| `/api/stop` | POST | Signal that agent stopped and needs attention |
| `/api/heartbeat` | POST | Keep session alive during long operations |
| `/api/unregister` | POST | Remove an instance |
| `/health` | GET | Health check endpoint |

## Request Body

All POST endpoints accept JSON with these optional fields:

```json
{
  "instanceId": "unique-id",
  "name": "Display Name",
  "source": "claude-code"
}
```

## Timeout Behavior

If no heartbeat is received for 5 minutes while in active state, the server automatically transitions to inactive (needs attention).

## Testing

```bash
# Check status
curl http://localhost:9999/api/status

# Start working
curl -X POST http://localhost:9999/api/start \
  -H "Content-Type: application/json" \
  -d '{"source": "test"}'

# Stop working
curl -X POST http://localhost:9999/api/stop \
  -H "Content-Type: application/json" \
  -d '{"source": "test"}'

# Send heartbeat
curl -X POST http://localhost:9999/api/heartbeat
```
