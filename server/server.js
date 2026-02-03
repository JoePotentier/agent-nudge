const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 9999;

// Middleware
app.use(cors());
app.use(express.json());

// State - track multiple instances
const instances = new Map(); // instanceId -> { isActive, lastActivity, name }
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
    // All instances need attention (or no instances registered)
    allNeedAttention: totalCount === 0 || activeCount === 0,
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

// POST /api/start - Signal Claude instance started working
app.post('/api/start', (req, res) => {
  const { instanceId = 'default', name } = req.body;

  instances.set(instanceId, {
    isActive: true,
    lastActivity: Date.now(),
    name: name || instanceId
  });

  console.log(`[${new Date().toISOString()}] Instance "${instanceId}" started working`);
  res.json({
    success: true,
    instanceId,
    ...getAggregatedStatus()
  });
});

// POST /api/stop - Signal Claude instance stopped/waiting
app.post('/api/stop', (req, res) => {
  const { instanceId = 'default' } = req.body;

  if (instances.has(instanceId)) {
    const instance = instances.get(instanceId);
    instance.isActive = false;
    instance.lastActivity = Date.now();
  } else {
    instances.set(instanceId, {
      isActive: false,
      lastActivity: Date.now(),
      name: instanceId
    });
  }

  console.log(`[${new Date().toISOString()}] Instance "${instanceId}" stopped - needs attention`);
  res.json({
    success: true,
    instanceId,
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
  ┌─────────────────────────────────────────────┐
  │         Refocus Status Server               │
  ├─────────────────────────────────────────────┤
  │  Running on http://localhost:${PORT}           │
  │                                             │
  │  Endpoints:                                 │
  │    GET  /api/status        - Get status     │
  │    POST /api/start         - Claude working │
  │         body: { instanceId, name }          │
  │    POST /api/stop          - Claude stopped │
  │         body: { instanceId }                │
  │    POST /api/heartbeat     - Keep alive     │
  │         body: { instanceId }                │
  │    POST /api/unregister    - Remove inst    │
  │         body: { instanceId }                │
  │    DELETE /api/instance/:id - Remove inst   │
  │    GET  /health            - Health check   │
  │                                             │
  │  Timeout: ${TIMEOUT_MS / 1000} seconds                      │
  └─────────────────────────────────────────────┘
  `);
});
