const express = require('express');
const cors = require('cors');

const app = express();
const PORT = parseInt(process.env.AGENT_NUDGE_PORT, 10) || 9999;

// Middleware
app.use(cors());
app.use(express.json());

// State - track multiple instances
const instances = new Map(); // instanceId -> { isActive, lastActivity, name, source }
const TIMEOUT_MS = 300000; // 5 minutes timeout

// Check for timeouts across all instances
function checkTimeouts() {
  const now = Date.now();
  for (const [id, instance] of instances) {
    if (instance.isActive && instance.lastActivity) {
      const elapsed = now - instance.lastActivity;
      if (elapsed > TIMEOUT_MS) {
        console.log(`[${new Date().toISOString()}] Instance "${id}" timed out due to inactivity`);
        instance.isActive = false;
      }
    }
  }
}

// Run timeout check every 10 seconds
setInterval(checkTimeouts, 10000);

// Get aggregated status
function getAggregatedStatus() {
  const allInstances = Array.from(instances.entries()).map(([id, inst]) => ({
    id,
    ...inst
  }));

  const activeCount = allInstances.filter(i => i.isActive).length;
  const needsAttentionCount = allInstances.filter(i => !i.isActive).length;
  const totalCount = allInstances.length;

  return {
    instances: allInstances,
    activeCount,
    needsAttentionCount,
    totalCount,
    // All instances need attention (only if there are instances registered)
    allNeedAttention: totalCount > 0 && activeCount === 0,
    // At least one instance needs attention
    someNeedAttention: needsAttentionCount > 0
  };
}

// GET /api/status - Returns current status for all instances
app.get('/api/status', (req, res) => {
  checkTimeouts();
  res.json({
    ...getAggregatedStatus(),
    uptime: process.uptime()
  });
});

// POST /api/start - Signal agent instance started working
app.post('/api/start', (req, res) => {
  const { instanceId = 'default', name, source = 'unknown' } = req.body;

  instances.set(instanceId, {
    isActive: true,
    lastActivity: Date.now(),
    name: name || instanceId,
    source
  });

  console.log(`[${new Date().toISOString()}] Instance "${instanceId}" (${source}) started working`);
  res.json({
    success: true,
    instanceId,
    source,
    ...getAggregatedStatus()
  });
});

// POST /api/stop - Signal agent instance stopped/waiting
app.post('/api/stop', (req, res) => {
  const { instanceId = 'default', source = 'unknown' } = req.body;

  if (instances.has(instanceId)) {
    const instance = instances.get(instanceId);
    instance.isActive = false;
    instance.lastActivity = Date.now();
    if (source !== 'unknown') instance.source = source;
  } else {
    instances.set(instanceId, {
      isActive: false,
      lastActivity: Date.now(),
      name: instanceId,
      source
    });
  }

  console.log(`[${new Date().toISOString()}] Instance "${instanceId}" (${source}) stopped - needs attention`);
  res.json({
    success: true,
    instanceId,
    source,
    ...getAggregatedStatus()
  });
});

// POST /api/heartbeat - Keep session alive during work
app.post('/api/heartbeat', (req, res) => {
  const { instanceId = 'default' } = req.body;

  if (instances.has(instanceId)) {
    const instance = instances.get(instanceId);
    if (instance.isActive) {
      instance.lastActivity = Date.now();
      console.log(`[${new Date().toISOString()}] Heartbeat from "${instanceId}"`);
    }
  }

  res.json({
    success: true,
    instanceId,
    ...getAggregatedStatus()
  });
});

// DELETE /api/instance/:id - Remove an instance
app.delete('/api/instance/:id', (req, res) => {
  const { id } = req.params;
  const deleted = instances.delete(id);

  if (deleted) {
    console.log(`[${new Date().toISOString()}] Instance "${id}" removed`);
  }

  res.json({
    success: deleted,
    ...getAggregatedStatus()
  });
});

// POST /api/unregister - Remove an instance (body-based, avoids URL encoding issues)
app.post('/api/unregister', (req, res) => {
  const { instanceId } = req.body;

  if (!instanceId) {
    return res.status(400).json({ error: 'instanceId is required' });
  }

  const deleted = instances.delete(instanceId);

  if (deleted) {
    console.log(`[${new Date().toISOString()}] Instance "${instanceId}" unregistered`);
  }

  res.json({
    success: deleted,
    ...getAggregatedStatus()
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Start server
app.listen(PORT, () => {
  console.log(`
  ┌─────────────────────────────────────────────────┐
  │         Agent Nudge Status Server               │
  ├─────────────────────────────────────────────────┤
  │  Running on http://localhost:${String(PORT).padEnd(5)}              │
  │                                                 │
  │  Endpoints:                                     │
  │    GET  /api/status        - Get status         │
  │    POST /api/start         - Agent working      │
  │         body: { instanceId, name, source }      │
  │    POST /api/stop          - Agent stopped      │
  │         body: { instanceId, source }            │
  │    POST /api/heartbeat     - Keep alive         │
  │         body: { instanceId }                    │
  │    POST /api/unregister    - Remove instance    │
  │         body: { instanceId }                    │
  │    DELETE /api/instance/:id - Remove instance   │
  │    GET  /health            - Health check       │
  │                                                 │
  │  Timeout: ${TIMEOUT_MS / 1000} seconds                          │
  │  Env var: AGENT_NUDGE_PORT (current: ${String(PORT).padEnd(5)})     │
  └─────────────────────────────────────────────────┘
  `);
});
