const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const connectDB = require('../config/db');
const { runDailyBlogAgent } = require('../agents/dailyBlogAgent');

(async () => {
  try {
    await connectDB();
    await runDailyBlogAgent();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();

export {};
