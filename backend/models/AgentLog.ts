const mongoose = require("mongoose");

const agentLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  type: { type: String, enum: ["info", "success", "error"] },
  message: String,
  topic: String,
  step: String,
  error: String
});

module.exports = mongoose.model("AgentLog", agentLogSchema);

export {};
