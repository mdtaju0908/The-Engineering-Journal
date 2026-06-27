const NotificationToken = require("../models/NotificationToken");
const admin = require("../config/firebaseAdmin");
const slugify = require("../utils/slugify");

function getClientBaseUrl() {
  return (process.env.CLIENT_URL || process.env.BRAND_URL || "https://mdtaju.tech").replace(/\/+$/, "");
}

function getBlogUrl(blog) {
  const categorySlug = slugify(blog.category || "general");
  return `${getClientBaseUrl()}/blog-post.html/${categorySlug}/${blog.slug}`;
}

function isFirebaseReady() {
  return Boolean(admin && Array.isArray(admin.apps) && admin.apps.length && typeof admin.messaging === "function");
}

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function isInvalidTokenError(error) {
  const code = error?.code || "";
  return [
    "messaging/invalid-registration-token",
    "messaging/registration-token-not-registered",
    "messaging/invalid-argument"
  ].includes(code);
}

async function deactivateInvalidTokens(tokens, response) {
  const invalidTokens = [];
  response.responses.forEach((item, index) => {
    if (!item.success && isInvalidTokenError(item.error)) {
      invalidTokens.push(tokens[index]);
    }
  });

  if (invalidTokens.length) {
    await NotificationToken.deleteMany({ token: { $in: invalidTokens } });
  }
}

function toPlainText(input = "", maxLen = 160) {
  return String(input || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

async function sendNotificationToSubscribers({ title, body, url, imageUrl }) {
  if (!isFirebaseReady()) {
    console.log("Firebase Admin not initialized; notifications disabled");
    return { successCount: 0, failureCount: 0, skipped: "firebase-not-ready" };
  }

  const tokenDocs = await NotificationToken.find({ isActive: true }).select("token").lean();
  const registrationTokens = [...new Set((tokenDocs || []).map((item) => item.token).filter(Boolean))];

  if (!registrationTokens.length) {
    console.log("No active notification tokens found");
    return { successCount: 0, failureCount: 0, skipped: "no-active-tokens" };
  }

  const absoluteUrl = url && /^https?:\/\//i.test(url) ? url : `${getClientBaseUrl()}${url || "/"}`;
  let successCount = 0;
  let failureCount = 0;

  for (const tokenBatch of chunk(registrationTokens, 500)) {
    const message = {
      notification: {
        title: title || "New Blog Published",
        body: body || "A new article has been posted. Click to read.",
        ...(imageUrl ? { imageUrl } : {})
      },
      data: {
        url: absoluteUrl
      },
      webpush: {
        fcmOptions: {
          link: absoluteUrl
        },
        notification: {
          icon: `${getClientBaseUrl()}/tej-logo-android-chrome-192x192.png`,
          badge: `${getClientBaseUrl()}/tej-logo-32x32.png`,
          ...(imageUrl ? { image: imageUrl } : {})
        }
      },
      tokens: tokenBatch
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    successCount += response.successCount;
    failureCount += response.failureCount;
    await deactivateInvalidTokens(tokenBatch, response);
  }

  console.log(`Notifications sent: ${successCount} success, ${failureCount} failed`);
  return { successCount, failureCount };
}

async function sendBlogPublishedNotification(blog) {
  const title = toPlainText(blog.title || "New Blog Published", 120);
  const description = toPlainText(blog.description || blog.content || "", 180);
  return sendNotificationToSubscribers({
    title,
    body: description || "A new article has been posted. Click to read.",
    url: getBlogUrl(blog),
    imageUrl: blog.coverImage || blog.imageUrl || blog.image || ""
  });
}

module.exports = {
  sendNotificationToSubscribers,
  sendBlogPublishedNotification,
  getBlogUrl
};

export {};
