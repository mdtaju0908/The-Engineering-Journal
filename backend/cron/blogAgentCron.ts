// cron/blogAgentCron.js
const cron = require("node-cron");
const AgentStatus = require("../models/AgentStatus");
const AgentSettings = require("../models/AgentSettings");
const { runDailyBlogAgent } = require("../agents/dailyBlogAgent");

// Primary schedule: 08:30 AM and 08:30 PM IST
cron.schedule("30 8,20 * * *", async () => {
  console.log("AI Blog Agent running (08:30 AM / 08:30 PM IST)");
  try {
    const settings = await AgentSettings.findOne();
    if (settings && settings.enabled === false) {
      console.log("AI Blog Agent disabled — skipping scheduled run");
      return;
    }
    await runDailyBlogAgent();
  } catch (e) {
    console.log("AI Blog Agent scheduled run guard failed:", e.message);
  }
}, {
  scheduled: true,
  timezone: "Asia/Kolkata"
});

// Recovery schedule: every minute check if needs to run
async function checkAndRecover() {
  try {
    const status = await AgentStatus.findOne().sort({ updatedAt: -1 });
    const settings = await AgentSettings.findOne();
    const now = new Date();
    if (!status) {
      await AgentStatus.updateOne({}, { isRunning: false, nextRunAt: now }, { upsert: true });
      return;
    }
    const shouldRunByTime = status.nextRunAt && now >= new Date(status.nextRunAt);
    const missedPublish = shouldRunByTime && status.lastPublished === false;
    const idle = status.isRunning === false;
    if (settings && settings.enabled === false) {
      return;
    }
    if (idle && (shouldRunByTime || missedPublish)) {
      console.log("AI Blog Agent recovery trigger: starting now");
      await runDailyBlogAgent();
    }
  } catch (err) {
    console.error("AI Blog Agent recovery check failed:", err.message);
  }
}

cron.schedule("* * * * *", checkAndRecover, { scheduled: true });

console.log("AI Blog Agent cron scheduled (08:30 AM & 08:30 PM IST) + recovery every minute");

export {};
