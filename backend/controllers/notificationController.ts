const NotificationToken = require("../models/NotificationToken");
const Blog = require("../models/Blog");
const {
  getBlogUrl,
  sendNotificationToSubscribers
} = require("../services/notificationService");

// @desc    Subscribe to push notifications
// @route   POST /api/notifications/subscribe
// @access  Public
const subscribe = async (req, res) => {
  try {
    const { token, deviceType } = req.body;
    const normalizedToken = String(token || "").trim();

    if (!normalizedToken) {
      return res.status(400).json({ message: "Token is required" });
    }

    const tokenExists = await NotificationToken.findOne({ token: normalizedToken });

    if (tokenExists) {
      tokenExists.deviceType = deviceType || tokenExists.deviceType;
      tokenExists.isActive = true;
      tokenExists.lastSeenAt = new Date();
      await tokenExists.save();
      return res.status(200).json({ message: "Already subscribed" });
    }

    await NotificationToken.create({
      token: normalizedToken,
      deviceType,
      isActive: true,
      lastSeenAt: new Date()
    });

    res.status(201).json({ message: "Subscribed successfully" });
  } catch (error) {
    console.error("Subscription Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Unsubscribe from push notifications
// @route   POST /api/notifications/unsubscribe
// @access  Public
const unsubscribe = async (req, res) => {
  try {
    const { token } = req.body || {};
    const normalizedToken = String(token || "").trim();
    if (!normalizedToken) {
      return res.status(400).json({ message: "Token is required" });
    }

    await NotificationToken.updateOne(
      { token: normalizedToken },
      { $set: { isActive: false } }
    );

    res.status(200).json({ message: "Unsubscribed successfully" });
  } catch (error) {
    console.error("Unsubscribe Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

function toPlainText(input = "", maxLen = 160) {
  return String(input || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

// @desc    Send blog notification to all active subscribers
// @route   POST /api/admin/blogs/:id/send-notification
// @access  Private/Admin
const sendBlogNotificationById = async (req, res) => {
  try {
    const blogId = String(req.params.id || "").trim();
    const blog = await Blog.findById(blogId).lean();
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    const result = await sendNotificationToSubscribers({
      title: blog.title || "New Blog Published",
      body: toPlainText(blog.description || blog.content || "A new article has been posted. Click to read."),
      url: getBlogUrl(blog),
      imageUrl: blog.coverImage || blog.imageUrl || blog.image || ""
    });

    res.json({
      message: "Notification dispatch completed",
      result
    });
  } catch (error) {
    console.error("Send Blog Notification Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  subscribe,
  unsubscribe,
  sendBlogNotificationById,
  sendNotificationToSubscribers
};

export {};
