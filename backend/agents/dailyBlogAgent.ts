// agents/dailyBlogAgent.js
const Blog = require("../models/Blog");
const AgentStatus = require("../models/AgentStatus");
const AgentLog = require("../models/AgentLog");
const AgentSettings = require("../models/AgentSettings");
const slugify = require("../utils/slugify");

const { getTrendingTopic } = require("../services/trendService");
const { generateBlogContent } = require("../services/blogGenerateService");
const { generateAndUploadCover } = require("../services/coverImageService");
const { sendBlogPublishedNotification } = require("../services/notificationService");
const { agentEvents } = require("../events/agentEvents");

function buildSourceSection(sources = [], blogSourceLinks = []) {
  const allowedUrls = new Set(Array.isArray(blogSourceLinks) ? blogSourceLinks : []);
  const selectedSources = Array.isArray(sources)
    ? sources.filter((source) => !allowedUrls.size || allowedUrls.has(source.url))
    : [];
  const finalSources = selectedSources.length ? selectedSources : sources;

  if (!Array.isArray(finalSources) || !finalSources.length) return "";

  const links = finalSources
    .slice(0, 6)
    .map((source) => `- [${source.source || source.title}](${source.url})`)
    .join("\n");

  return `\n\n## Sources\n${links}`;
}

async function log(type, message, topic = "", step = "") {
  const payload = { type, message, topic, step, timestamp: new Date() };
  await AgentLog.create(payload);
  agentEvents.emit("status", payload);
  console.log(`[${type.toUpperCase()}] ${message}`);
}

async function runDailyBlogAgent() {
  await AgentStatus.updateOne(
    {},
    { isRunning: true, lastImageGenerated: false, lastBlogWritten: false, lastPublished: false, updatedAt: new Date() },
    { upsert: true }
  );

  try {
    await log("info", "AI Blog Agent started", "", "agent_started");
    await log("info", "Searching recent news and articles across the web...", "", "fetching_trends");

    const { topic, category, sources = [], searchContext = null } = await getTrendingTopic();
    await log("success", `Topic chosen: ${topic} (${category})`, topic, "topic_selected");
    await log(
      "info",
      `Using ${sources.length} recent source(s) from Tavily/SerpAPI/Google News RSS${searchContext?.usedFallback ? " + fallback" : ""}`,
      topic,
      "sources_selected"
    );

    await log("info", "Generating SEO optimized content from recent sources...", topic, "generating_blog_content");
    const blogData = await generateBlogContent(topic, category, sources);
    await log("success", "Blog content generated", topic, "generating_blog_content");
    await AgentStatus.updateOne({}, { lastBlogWritten: true, updatedAt: new Date() });

    await log("info", "Generating category-specific cover image...", topic, "generating_cover_image");
    let coverUrl;
    let imageSource = "";
    try {
      await log("info", "Uploading image to Cloudinary...", topic, "uploading_image");
      const cover = await generateAndUploadCover(blogData.mainTitle, category);
      coverUrl = cover && cover.url ? cover.url : "";
      imageSource = cover && cover.source ? cover.source : "";
    } catch (e) {
      await log("error", `Cover generation failed: ${e.message}`, topic, "generating_cover_image");
      await log("info", "Uploading image to Cloudinary...", topic, "uploading_image");
      const cover = await generateAndUploadCover(blogData.mainTitle, category);
      coverUrl = cover && cover.url ? cover.url : "";
      imageSource = cover && cover.source ? cover.source : "";
    }
    await log("success", "Cover image prepared", topic, "generating_cover_image");
    await AgentStatus.updateOne({}, { lastImageGenerated: true, lastCoverUrl: coverUrl, updatedAt: new Date() });

    let slugBase = slugify(blogData.mainTitle);
    let slug = slugBase;
    let counter = 1;
    while (await Blog.findOne({ slug })) {
      slug = `${slugBase}-${counter++}`;
    }

    const sourceSection = buildSourceSection(sources, blogData.sourceLinks);

    const newBlog = new Blog({
      title: blogData.mainTitle,
      slug,
      description: blogData.metaDescription || blogData.introduction?.slice(0, 200) || "",
      content: `${blogData.introduction}\n\n${blogData.markdownBody}\n\n${blogData.conclusion}${sourceSection}`,
      category,
      status: "published",
      image: coverUrl,
      imageUrl: coverUrl,
      coverImage: coverUrl,
      imageSource: imageSource || "",
      author: "AI Agent",
      metaKeywords: Array.isArray(blogData.tags) ? blogData.tags : [],
      createdAt: new Date()
    });

    await log("info", "Saving blog to database...", topic, "saving_blog_to_database");
    await newBlog.save();
    await log("success", `Blog published -> ${blogData.mainTitle}`, topic, "blog_published");
    await AgentStatus.updateOne({}, { lastPublished: true, updatedAt: new Date() });

    try {
      await log("info", "Sending blog notification to subscribers...", topic, "sending_notification");
      const notifyResult = await sendBlogPublishedNotification(newBlog);
      await log(
        "success",
        `Notifications sent: ${notifyResult.successCount || 0} success, ${notifyResult.failureCount || 0} failed`,
        topic,
        "notification_sent"
      );
    } catch (e) {
      await log("error", `Notification dispatch failed: ${e.message}`, topic, "sending_notification");
    }

    try {
      const { rebuildSitemap, pingSearchEngines } = require("../controllers/indexingController");
      await rebuildSitemap();
      await pingSearchEngines();
    } catch (e) {
      await log("error", `Indexing update failed: ${e.message}`, topic, "indexing_update");
    }

    const settings = await AgentSettings.findOne();
    const intervalHours = settings && settings.intervalHours ? settings.intervalHours : 12;
    const now = new Date();
    const nextRunAt = new Date(now.getTime() + intervalHours * 60 * 60 * 1000);

    await AgentStatus.updateOne({}, {
      isRunning: false,
      lastTopic: topic,
      lastGeneratedAt: new Date(),
      nextRunAt,
      updatedAt: new Date()
    });
    await AgentSettings.updateOne({}, { lastRun: now, nextRun: nextRunAt }, { upsert: true });

    await log("success", "AI Blog Agent completed", topic, "agent_completed");
  } catch (err) {
    await log("error", `Agent failed: ${err.message}`, "", "error");
    const now = new Date();
    const retryAt = new Date(now.getTime() + 60 * 1000);
    await AgentStatus.updateOne({}, { isRunning: false, nextRunAt: retryAt, updatedAt: new Date() });
  }
}

module.exports = { runDailyBlogAgent };

export {};
