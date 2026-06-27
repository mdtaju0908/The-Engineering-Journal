const mongoose = require("mongoose");

const agentSettingsSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: true },
  intervalHours: { type: Number, default: 12 },
  lastRun: Date,
  nextRun: Date
}, { timestamps: true });

module.exports = mongoose.model("AgentSettings", agentSettingsSchema);

export {};
