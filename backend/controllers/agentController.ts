// controllers/agentController.js
const AgentStatus = require('../models/AgentStatus');
const AgentSettings = require('../models/AgentSettings');
const AgentLog = require('../models/AgentLog');
const { runDailyBlogAgent } = require('../agents/dailyBlogAgent');

const getAgentStatus = async (req, res) => {
  try {
    let status = await AgentStatus.findOne().sort({ updatedAt: -1 });
    let settings = await AgentSettings.findOne();

    if (!status) {
      status = {
        isRunning: false,
        lastTopic: null,
        lastCoverUrl: null,
        lastGeneratedAt: null,
        nextRunAt: null,
        lastImageGenerated: false,
        lastBlogWritten: false,
        lastPublished: false,
      };
    }

    if (!settings) {
      settings = {
        enabled: true,
        intervalHours: 12,
        lastRun: null,
        nextRun: status.nextRunAt || null,
      };
    }

    const recentLogs = await AgentLog.find()
      .sort({ timestamp: -1 })
      .limit(15);
    const latestLog = recentLogs && recentLogs.length ? recentLogs[0] : null;
    const plainStatus = status && typeof status.toObject === 'function' ? status.toObject() : status;
    const nextRun = plainStatus.nextRunAt || settings.nextRun || null;
    const step = latestLog?.step || (plainStatus.isRunning ? 'agent_started' : 'idle');

    res.status(200).json({
      success: true,
      status: {
        ...plainStatus,
        step,
        topic: latestLog?.topic || plainStatus.lastTopic || null,
        nextRun,
      },
      settings,
      nextRun,
      logs: recentLogs,
    });
  } catch (err) {
    console.error('[agentController] getAgentStatus error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch agent status',
      message: err.message,
    });
  }
};

const triggerAgentManually = async (req, res) => {
  try {
    // Optional: add rate limiting or admin check later
    runDailyBlogAgent();
    res.status(200).json({
      success: true,
      message: 'AI Blog Agent triggered manually — check logs in a few minutes',
    });
  } catch (err) {
    console.error('[agentController] trigger error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger agent',
      message: err.message,
    });
  }
};

const toggleAgent = async (req, res) => {
  try {
    const enabled = !!(req.body && req.body.enabled);
    const settings = await AgentSettings.findOneAndUpdate(
      {},
      { enabled, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    await AgentLog.create({ type: 'info', message: `Agent toggled: ${enabled ? 'ON' : 'OFF'}`, step: 'toggle' });
    res.status(200).json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const scheduleAgent = async (req, res) => {
  try {
    const intervalHours = Number((req.body && req.body.intervalHours) || 12);
    const clamped = [6,12,24].includes(intervalHours) ? intervalHours : 12;
    const now = new Date();
    const nextRun = new Date(now.getTime() + clamped * 60 * 60 * 1000);
    const settings = await AgentSettings.findOneAndUpdate(
      {},
      { intervalHours: clamped, nextRun, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    await AgentStatus.updateOne({}, { nextRunAt: nextRun }, { upsert: true });
    await AgentLog.create({ type: 'info', message: `Agent schedule set to ${clamped}h`, step: 'schedule' });
    res.status(200).json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const runAgentNow = async (req, res) => {
  try {
    runDailyBlogAgent();
    res.status(200).json({ success: true, message: 'Agent started' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getAgentStatus,
  triggerAgentManually,
  toggleAgent,
  scheduleAgent,
  runAgentNow,
};

export {};
