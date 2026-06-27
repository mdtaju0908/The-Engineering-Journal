const mongoose = require("mongoose");

const agentStatusSchema = new mongoose.Schema(
  {
    isRunning: { type: Boolean, default: false },
    lastTopic: String,
    lastCoverUrl: String,
    lastGeneratedAt: Date,
    nextRunAt: Date,
    lastImageGenerated: { type: Boolean, default: false },
    lastBlogWritten: { type: Boolean, default: false },
    lastPublished: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AgentStatus", agentStatusSchema);

export {};
