// routes/agentRoutes.js
const express = require('express');
const router = express.Router();

const {
  getAgentStatus,
  triggerAgentManually,
  toggleAgent,
  scheduleAgent,
  runAgentNow,
} = require('../controllers/agentController');
const { agentEvents } = require('../events/agentEvents');

// Optional: protect these routes if needed
// const { protect, admin } = require('../middleware/authMiddleware');

// Public or semi-public status (frontend widget)
// router.get('/status', getAgentStatus);

// Only admin / you can trigger manually
router.get('/status', getAgentStatus);              // ← for widget (can be public)
router.post('/trigger', triggerAgentManually);      // ← protect this in production!
router.post('/toggle', toggleAgent);
router.post('/schedule', scheduleAgent);
router.post('/run', runAgentNow);

router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();

  const send = (payload) => {
    try {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch {}
  };

  const listener = (payload) => send(payload);
  agentEvents.on('status', listener);

  req.on('close', () => {
    agentEvents.off('status', listener);
  });
});

module.exports = router;

export {};
