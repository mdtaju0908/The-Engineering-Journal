const Blog = require('../models/Blog');
const BlogView = require('../models/BlogView');
const Comment = require('../models/Comment');
const { generateAndUploadCover } = require('../services/coverImageService');
const { sendBlogPublishedNotification } = require('../services/notificationService');
const slugify = require('../utils/slugify');
const crypto = require('crypto');
const mongoose = require('mongoose');

function isAllowedImageUrl(url) {
  if (!url) return true;
  const u = url.toLowerCase();
  return u.endsWith('.png') || u.endsWith('.jpg') || u.endsWith('.jpeg');
}

function toCategorySlug(cat = '') {
  return slugify(cat || 'general');
}

const BOT_UA_RE = /bot|crawl|spider|slurp|bingpreview|google-inspectiontool|lighthouse|pagespeed|gtmetrix|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot/i;
const DEFAULT_DISCOVER_IMAGE = String(process.env.BRAND_OG_IMAGE || 'https://the-engineering-journal.mdtaju.tech/tej-logo-android-chrome-512x512.png').trim();
const BRAND_PUBLISHER_NAME = String(process.env.BRAND_PUBLISHER_NAME || 'The Engineering Journal').trim();

function hashValue(value = '') {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function cleanHeader(value = '', fallback = 'unknown', maxLen = 80) {
  const cleaned = String(value || '')
    .trim()
    .replace(/[^\w .+/-]/g, '')
    .slice(0, maxLen);
  return cleaned || fallback;
}

function normalizeDeviceType(value = '') {
  const type = cleanHeader(value, 'unknown', 24).toLowerCase();
  if (['mobile', 'tablet', 'desktop'].includes(type)) return type;
  if (type.includes('tablet') || type.includes('ipad')) return 'tablet';
  if (type.includes('mobile') || type.includes('phone') || type.includes('ios') || type.includes('android')) return 'mobile';
  if (type.includes('desktop')) return 'desktop';
  return 'unknown';
}

function readRequestValue(req, headerName, ...fieldNames) {
  const candidates = [req.headers?.[headerName]];
  fieldNames.forEach((fieldName) => {
    candidates.push(req.query?.[fieldName]);
    candidates.push(req.body?.[fieldName]);
  });

  for (const raw of candidates) {
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }

  return '';
}

async function findBlogBySlugOrId(identifier = '') {
  const value = String(identifier || '').trim();
  if (!value) return null;

  const bySlug = await Blog.findOne({ slug: value });
  if (bySlug) return bySlug;

  if (mongoose.Types.ObjectId.isValid(value)) {
    return Blog.findById(value);
  }

  return null;
}

async function getSyncedViewCount(blogId, fallback = 0) {
  const latest = await Blog.findById(blogId).select('views').lean();
  const stored = Number.isFinite(Number(latest?.views)) ? Number(latest.views) : Number(fallback || 0);

  let uniqueCount = stored;
  try {
    uniqueCount = await BlogView.countDocuments({ blog: blogId });
  } catch (_) {
    uniqueCount = stored;
  }

  if (uniqueCount > stored) {
    await Blog.updateOne(
      {
        _id: blogId,
        $or: [{ views: { $lt: uniqueCount } }, { views: { $exists: false } }]
      },
      { $set: { views: uniqueCount } }
    ).catch(() => {});
    return uniqueCount;
  }

  return stored;
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getLargeImageUrl(url = '') {
  if (!url) return DEFAULT_DISCOVER_IMAGE;
  try {
    if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
    const parts = url.split('/upload/');
    return `${parts[0]}/upload/c_fill,g_auto,w_1200,h_675,f_jpg,q_auto:good/${parts[1].replace(/\/v\d+\//, '/')}`;
  } catch (_) {
    return url;
  }
}

function sanitizeCommentName(value = '') {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function sanitizeCommentContent(value = '') {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 2000);
}

function inferImageMimeType(url = '') {
  const value = String(url || '').toLowerCase();
  if (value.endsWith('.png')) return 'image/png';
  if (value.endsWith('.webp')) return 'image/webp';
  if (value.endsWith('.avif')) return 'image/avif';
  if (value.endsWith('.gif')) return 'image/gif';
  if (value.endsWith('.svg')) return 'image/svg+xml';
  return 'image/jpeg';
}

function getArticleImageObjects(url = '') {
  if (!url) return undefined;
  try {
    if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) {
      return [{ "@type": "ImageObject", url, contentUrl: url }];
    }
    const parts = url.split('/upload/');
    const publicId = parts[1].replace(/\/v\d+\//, '/');
    return [
      {
        "@type": "ImageObject",
        url: `${parts[0]}/upload/c_fill,g_auto,w_1200,h_675,f_jpg,q_auto:good/${publicId}`,
        contentUrl: `${parts[0]}/upload/c_fill,g_auto,w_1200,h_675,f_jpg,q_auto:good/${publicId}`,
        width: 1200,
        height: 675
      },
      {
        "@type": "ImageObject",
        url: `${parts[0]}/upload/c_fill,g_auto,w_1200,h_900,f_jpg,q_auto:good/${publicId}`,
        contentUrl: `${parts[0]}/upload/c_fill,g_auto,w_1200,h_900,f_jpg,q_auto:good/${publicId}`,
        width: 1200,
        height: 900
      },
      {
        "@type": "ImageObject",
        url: `${parts[0]}/upload/c_fill,g_auto,w_1200,h_1200,f_jpg,q_auto:good/${publicId}`,
        contentUrl: `${parts[0]}/upload/c_fill,g_auto,w_1200,h_1200,f_jpg,q_auto:good/${publicId}`,
        width: 1200,
        height: 1200
      }
    ];
  } catch (_) {
    return [{ "@type": "ImageObject", url, contentUrl: url }];
  }
}

function extractCitationUrls(input = '', limit = 6) {
  const text = String(input || '');
  if (!text) return [];
  const matches = text.match(/https?:\/\/[^\s<>"')\]]+/gi) || [];
  const cleaned = matches
    .map((url) => url.replace(/[.,;:!?]+$/, ''))
    .filter(Boolean);
  return [...new Set(cleaned)].slice(0, limit);
}

function toAbsoluteUrl(url = '', brandUrl = 'https://mdtaju.tech') {
  if (!url) return '';
  const cleanUrl = String(url).trim();
  if (/^https?:\/\//i.test(cleanUrl)) return cleanUrl;
  if (cleanUrl.startsWith('//')) return `https:${cleanUrl}`;
  const origin = String(brandUrl || 'https://mdtaju.tech').replace(/\/+$/, '');
  return `${origin}/${cleanUrl.replace(/^\/+/, '')}`;
}

const getBlogs = async (req, res) => {
  try {
    const pageNumber = parseInt(req.query.pageNumber || '1', 10);
    const pageSize = parseInt(req.query.pageSize || '10', 10);
    const keyword = (req.query.keyword || '').trim();
    const category = (req.query.category || '').trim();

    const filter: any = {};
    if (keyword) {
      filter.$or = [
        { title: { $regex: keyword, $options: 'i' } },
        { description: { $regex: keyword, $options: 'i' } },
        { content: { $regex: keyword, $options: 'i' } },
        { category: { $regex: keyword, $options: 'i' } },
        { metaKeywords: { $regex: keyword, $options: 'i' } },
      ];
    }
    if (category) {
      filter.category = category;
    }

    const total = await Blog.countDocuments(filter);
    const blogs = await Blog.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .lean();

    res.json({ success: true, blogs: blogs || [], pages: Math.ceil(total / pageSize) });
  } catch (error) {
    res.status(500).json({ success: false, blogs: [], message: error.message });
  }
};

const getBlogById = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id).lean();
    if (!blog) return res.status(404).json({ message: 'Blog not found' });
    res.json(blog);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getBlogBySlug = async (req, res) => {
  try {
    const blog = await Blog.findOne({ slug: req.params.slug }).lean();
    if (!blog) return res.status(404).json({ message: 'Blog not found' });
    res.json(blog);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createBlog = async (req, res) => {
  try {
    const { title, description, content, category, author, image, imageUrl, coverImage, videoUrl, youtubeUrl, metaKeywords } = req.body;
    const slug = slugify(title);

    if (!isAllowedImageUrl(coverImage || imageUrl || image)) {
      return res.status(400).json({ message: 'Image URL must end with .png, .jpg, or .jpeg' });
    }

    let finalSlug = slug;
    let counter = 1;
    while (await Blog.findOne({ slug: finalSlug })) {
      finalSlug = `${slug}-${counter++}`;
    }

    const blog = new Blog({
      title,
      slug: finalSlug,
      description,
      content,
      category,
      author,
      image: image || '',
      imageUrl: imageUrl || '',
      coverImage: coverImage || imageUrl || '',
      videoUrl: videoUrl || '',
      youtubeUrl: youtubeUrl || '',
      metaKeywords: Array.isArray(metaKeywords) ? metaKeywords : (metaKeywords ? metaKeywords.split(',').map(k => k.trim()) : [])
    });

    const created = await blog.save();

    try {
      await sendBlogPublishedNotification(created);
    } catch (e) {
      console.error('Notification dispatch failed', e);
    }

    try {
      const { rebuildSitemap, pingSearchEngines } = require('./indexingController');
      await rebuildSitemap();
      await pingSearchEngines();
    } catch (e) {
      console.error('Indexing update failed', e);
    }

    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ message: 'Blog not found' });

    if (req.body.coverImage || req.body.imageUrl || req.body.image) {
      const url = (req.body.coverImage || req.body.imageUrl || req.body.image || '').toLowerCase();
      if (url && !isAllowedImageUrl(url)) {
        return res.status(400).json({ message: 'Image URL must end with .png, .jpg, or .jpeg' });
      }
    }

    const originalTitle = blog.title;
    // Update slug only if the title actually changes
    if (typeof req.body.title === 'string' && req.body.title.trim() && req.body.title.trim() !== originalTitle) {
      const baseSlug = slugify(req.body.title);
      let finalSlug = baseSlug;
      let counter = 1;
      while (await Blog.findOne({ slug: finalSlug, _id: { $ne: blog._id } })) {
        finalSlug = `${baseSlug}-${counter++}`;
      }
      blog.slug = finalSlug;
    }
    blog.title = req.body.title || blog.title;
    blog.description = req.body.description || blog.description;
    blog.content = req.body.content || blog.content;
    blog.category = req.body.category || blog.category;
    blog.author = req.body.author || blog.author;
    if (req.body.image !== undefined) blog.image = req.body.image;
    if (req.body.imageUrl !== undefined) blog.imageUrl = req.body.imageUrl;
    if (req.body.coverImage !== undefined) blog.coverImage = req.body.coverImage;
    if (req.body.videoUrl !== undefined) blog.videoUrl = req.body.videoUrl;
    if (req.body.youtubeUrl !== undefined) blog.youtubeUrl = req.body.youtubeUrl;
    if (req.body.metaKeywords !== undefined) {
      blog.metaKeywords = Array.isArray(req.body.metaKeywords)
        ? req.body.metaKeywords
        : (req.body.metaKeywords ? req.body.metaKeywords.split(',').map(k => k.trim()) : []);
    }

    // Slug remains unchanged when title is not modified

    const updated = await blog.save();
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ message: 'Blog not found' });
    await blog.deleteOne();
    res.json({ message: 'Blog removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const reactToBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ message: 'Blog not found' });
    blog.likes = (blog.likes || 0) + 1;
    await blog.save();
    res.json({ likes: blog.likes });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getCommentsByBlog = async (req, res) => {
  try {
    const blog = await findBlogBySlugOrId(req.params.id);
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found', comments: [] });

    const pageNumber = Math.max(1, parseInt(req.query.pageNumber || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '20', 10)));
    const status = String(req.query.status || 'approved').trim().toLowerCase();
    const allowedStatuses = new Set(['approved', 'pending', 'spam', 'all']);
    const resolvedStatus = allowedStatuses.has(status) ? status : 'approved';

    const filter: any = { blog: blog._id };
    if (resolvedStatus !== 'all') filter.status = resolvedStatus;

    const total = await Comment.countDocuments(filter);
    const comments = await Comment.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .select('name content likes status createdAt updatedAt')
      .lean();

    res.json({
      success: true,
      comments: comments || [],
      pageNumber,
      pages: Math.ceil(total / pageSize),
      total
    });
  } catch (error) {
    res.status(500).json({ success: false, comments: [], message: error.message });
  }
};

const addComment = async (req, res) => {
  try {
    const blog = await findBlogBySlugOrId(req.params.id);
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });

    const name = sanitizeCommentName(req.body?.name || req.body?.author || 'Anonymous');
    const content = sanitizeCommentContent(req.body?.content || req.body?.message || '');

    if (!name || name.length < 2) {
      return res.status(400).json({ success: false, message: 'Name must be at least 2 characters' });
    }

    if (!content || content.length < 3) {
      return res.status(400).json({ success: false, message: 'Comment must be at least 3 characters' });
    }

    const comment = await Comment.create({
      blog: blog._id,
      name,
      content,
      status: 'approved'
    });

    res.status(201).json({
      success: true,
      comment: {
        _id: comment._id,
        name: comment.name,
        content: comment.content,
        likes: comment.likes || 0,
        status: comment.status,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const likeComment = async (req, res) => {
  try {
    const blog = await findBlogBySlugOrId(req.params.id);
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });

    const commentId = String(req.params.commentId || '');
    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ success: false, message: 'Invalid comment id' });
    }

    const updated = await Comment.findOneAndUpdate(
      { _id: commentId, blog: blog._id, status: 'approved' },
      { $inc: { likes: 1 } },
      { new: true, select: 'likes' }
    ).lean();

    if (!updated) return res.status(404).json({ success: false, message: 'Comment not found' });

    res.json({ success: true, commentId, likes: Number(updated.likes || 0) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const incrementView = async (req, res) => {
  try {
    const blog = await findBlogBySlugOrId(req.params.slug);
    if (!blog) return res.status(404).json({ message: 'Blog not found' });

    const ipRaw = (req.headers['x-forwarded-for'] || req.ip || '').toString();
    const ip = ipRaw.split(',')[0].trim();
    const ua = (req.headers['user-agent'] || '').toString();
    const lang = (req.headers['accept-language'] || '').toString();
    const fresh = async () => getSyncedViewCount(blog._id, blog.views || 0);

    if (BOT_UA_RE.test(ua)) {
      return res.json({ views: await fresh(), unique: false, skipped: 'bot' });
    }

    const deviceId = cleanHeader(readRequestValue(req, 'x-device-id', 'deviceId', 'device_id'), '', 160);
    const viewSession = cleanHeader(readRequestValue(req, 'x-view-session', 'viewSession', 'view_session'), '', 160);
    const deviceType = normalizeDeviceType(readRequestValue(req, 'x-device-type', 'deviceType', 'device_type'));
    const deviceOs = cleanHeader(readRequestValue(req, 'x-device-os', 'deviceOs', 'device_os'));
    const deviceBrowser = cleanHeader(readRequestValue(req, 'x-device-browser', 'deviceBrowser', 'device_browser'));
    const fallbackWindowMinutes = Number.parseInt(process.env.BLOG_VIEW_WINDOW_MINUTES || '1440', 10);
    const safeWindowMinutes = Number.isFinite(fallbackWindowMinutes) && fallbackWindowMinutes > 0
      ? fallbackWindowMinutes
      : 1440;
    const viewBucket = Math.floor(Date.now() / (safeWindowMinutes * 60 * 1000));
    const fingerprintBase = viewSession
      ? `session:${viewSession}`
      : deviceId
        ? `device:${deviceId}|bucket:${viewBucket}`
        : `fallback:${ip}|${ua}|${lang}|${deviceType}|${deviceOs}|${deviceBrowser}|bucket:${viewBucket}`;
    const viewerHash = hashValue(fingerprintBase);
    const viewMeta = {
      blog: blog._id,
      viewerHash,
      deviceType,
      deviceOs,
      deviceBrowser,
      ipHash: ip ? hashValue(ip) : '',
      userAgentHash: ua ? hashValue(ua) : ''
    };

    let uniqueViewer = false;
    try {
      await BlogView.create(viewMeta);
      uniqueViewer = true;
    } catch (err) {
      // E11000 => same device already counted for this blog
      if (err?.code !== 11000) throw err;
      await BlogView.updateOne(
        { blog: blog._id, viewerHash },
        { $set: { deviceType, deviceOs, deviceBrowser } }
      ).catch(() => {});
    }

    const updated = await Blog.findByIdAndUpdate(
      blog._id,
      { $inc: { views: 1 } },
      { new: true, select: 'views' }
    ).lean();
    blog.views = (updated && Number.isFinite(Number(updated.views)))
      ? Number(updated.views)
      : (blog.views || 0) + 1;
    blog.views = await getSyncedViewCount(blog._id, blog.views);

    const viewSocketHub = req.app && typeof req.app.get === 'function' ? req.app.get('viewSocketHub') : null;
    if (viewSocketHub && typeof viewSocketHub.broadcastViewUpdate === 'function') {
      viewSocketHub.broadcastViewUpdate(blog.slug, blog.views, { unique: uniqueViewer });
    }

    res.json({ views: blog.views, unique: uniqueViewer, deviceType, deviceOs, deviceBrowser });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const redirectBySlug = async (req, res) => {
  try {
    const slug = req.params.slug;
    const blog = await Blog.findOne({ slug }).lean();
    if (!blog) return res.status(404).json({ message: 'Blog not found' });
    const categorySlug = toCategorySlug(blog.category);
    const target = `https://mdtaju.tech/blog-post.html/${categorySlug}/${blog.slug}`;
    res.setHeader('Location', target);
    return res.status(301).end();
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const generateCover = async (req, res) => {
  try {
    const { title, category } = req.body || {};
    if (!title) return res.status(400).json({ message: 'Title is required' });
    const result = await generateAndUploadCover(title, category || 'Technology');
    if (!result || !result.url) return res.status(500).json({ message: 'Failed to generate cover' });
    res.json({ url: result.url, imageSource: result.source });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const ogMetaBySlug = async (req, res) => {
  try {
    res.setHeader('X-Robots-Tag', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    const brandUrl = (process.env.BRAND_URL || 'https://mdtaju.tech').replace(/\/+$/, '');
    const fallbackImage = toAbsoluteUrl(DEFAULT_DISCOVER_IMAGE, brandUrl);
    const feedUrl = `${brandUrl}/feed.xml`;
    const slug = req.params.slug;
    const blog = await Blog.findOne({ slug }).lean();
    if (!blog) {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      const notFoundImageMeta = fallbackImage
        ? [
            `<meta property="og:image" content="${fallbackImage}">`,
            `<meta property="og:image:secure_url" content="${fallbackImage}">`,
            `<meta property="og:image:url" content="${fallbackImage}">`,
            '<meta property="og:image:width" content="1200">',
            '<meta property="og:image:height" content="675">',
            '<meta property="og:image:type" content="image/jpeg">',
            '<meta property="og:image:alt" content="The Engineering Journal preview image">',
            `<link rel="image_src" href="${fallbackImage}">`,
            `<meta name="twitter:image" content="${fallbackImage}">`,
            '<meta name="twitter:image:alt" content="The Engineering Journal preview image">',
          ]
        : [];
      const notFoundTwitterCard = fallbackImage ? 'summary_large_image' : 'summary';

      res.status(404).type('text/html').send([
        '<!DOCTYPE html>',
        '<html><head>',
        '<meta charset="utf-8">',
        '<meta name="robots" content="noindex, nofollow">',
        '<meta name="googlebot" content="noindex, nofollow">',
        `<meta property="og:title" content="Not Found">`,
        `<meta property="og:description" content="Blog not found">`,
        `<meta property="og:type" content="article">`,
        ...notFoundImageMeta,
        `<meta property="og:url" content="${brandUrl}/blog-post.html/${slug}">`,
        `<meta name="twitter:card" content="${notFoundTwitterCard}">`,
        `<meta name="twitter:title" content="Not Found">`,
        `<meta name="twitter:description" content="Blog not found">`,
        `<meta name="twitter:url" content="${brandUrl}/blog-post.html/${slug}">`,
        '</head><body></body></html>'
      ].join('\n'));
      return;
    }
    const categorySlug = toCategorySlug(blog.category || 'general');
    const pageUrl = `${brandUrl}/${categorySlug}/${blog.slug}`;
    const title = blog.title || 'Article';
    const description = (blog.description || title).slice(0, 300);
    const image = toAbsoluteUrl(getLargeImageUrl(blog.coverImage || blog.imageUrl || blog.image || ''), brandUrl);
    const imageMimeType = inferImageMimeType(image);
    const hasImage = Boolean(image);
    const twitterCardType = hasImage ? 'summary_large_image' : 'summary';
    const ogImageMeta = hasImage
      ? [
          `  <meta property="og:image" content="${escapeHtml(image)}">`,
          `  <meta property="og:image:url" content="${escapeHtml(image)}">`,
          `  <meta property="og:image:secure_url" content="${escapeHtml(image)}">`,
          '  <meta property="og:image:width" content="1200">',
          '  <meta property="og:image:height" content="675">',
          `  <meta property="og:image:type" content="${escapeHtml(imageMimeType)}">`,
          `  <meta property="og:image:alt" content="${escapeHtml(title)}">`,
          `  <link rel="image_src" href="${escapeHtml(image)}">`,
        ]
      : [];
    const twitterImageMeta = hasImage
      ? [
          `  <meta name="twitter:image" content="${escapeHtml(image)}">`,
          `  <meta name="twitter:image:alt" content="${escapeHtml(title)}">`,
        ]
      : [];
    const datePublished = blog.createdAt ? new Date(blog.createdAt).toISOString() : new Date().toISOString();
    const dateModified = blog.updatedAt ? new Date(blog.updatedAt).toISOString() : datePublished;
    const citationUrls = extractCitationUrls(`${blog.content || ''}\n${blog.description || ''}`);
    const articleJsonLd = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "@id": `${pageUrl}#article`,
      url: pageUrl,
      headline: title,
      description,
      image: getArticleImageObjects(image),
      datePublished,
      dateModified,
      author: { "@type": "Person", name: blog.author || 'Md Taju', url: brandUrl },
      publisher: {
        "@type": "Organization",
        name: BRAND_PUBLISHER_NAME,
        logo: { "@type": "ImageObject", url: `${brandUrl}/tej-logo-android-chrome-512x512.png`, width: 512, height: 512 }
      },
      mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl },
      articleSection: blog.category || 'General',
      interactionStatistic: {
        "@type": "InteractionCounter",
        interactionType: { "@type": "ViewAction" },
        userInteractionCount: Number(blog.views || 0)
      },
      citation: citationUrls.length ? citationUrls : undefined,
      inLanguage: ["en-IN", "hi-IN"],
      isAccessibleForFree: true
    };

    const html = [
      '<!DOCTYPE html>',
      '<html lang="en">',
      '<head>',
      '  <meta charset="utf-8">',
      '  <meta name="viewport" content="width=device-width, initial-scale=1">',
      '  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">',
      '  <meta name="googlebot" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">',
      `  <link rel="alternate" type="application/rss+xml" title="The Engineering Journal RSS" href="${escapeHtml(feedUrl)}">`,
      `  <title>${escapeHtml(title)}</title>`,
      `  <meta name="description" content="${escapeHtml(description)}">`,
      `  <link rel="canonical" href="${escapeHtml(pageUrl)}">`,
      '  <meta property="og:type" content="article">',
      '  <meta property="og:locale" content="en_IN">',
      '  <meta property="og:site_name" content="The Engineering Journal">',
      `  <meta property="og:title" content="${escapeHtml(title)}">`,
      `  <meta property="og:description" content="${escapeHtml(description)}">`,
      `  <meta property="og:url" content="${escapeHtml(pageUrl)}">`,
      ...ogImageMeta,
      `  <meta property="article:published_time" content="${datePublished}">`,
      `  <meta property="article:modified_time" content="${dateModified}">`,
      `  <meta property="article:section" content="${escapeHtml(blog.category || 'General')}">`,
      `  <meta name="twitter:card" content="${twitterCardType}">`,
      `  <meta name="twitter:url" content="${escapeHtml(pageUrl)}">`,
      `  <meta name="twitter:title" content="${escapeHtml(title)}">`,
      `  <meta name="twitter:description" content="${escapeHtml(description)}">`,
      ...twitterImageMeta,
      `  <script type="application/ld+json">${JSON.stringify(articleJsonLd)}</script>`,
      '</head>',
      '<body></body>',
      '</html>'
    ].join('\n');
    res.status(200).type('text/html').send(html);
  } catch (error) {
    res.status(500).type('text/html').send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Error</title></head><body>Error: ${error.message}</body></html>`);
  }
};

module.exports = {
  getBlogs,
  getBlogById,
  getBlogBySlug,
  createBlog,
  updateBlog,
  deleteBlog,
  reactToBlog,
  incrementView,
  redirectBySlug,
  generateCover,
  ogMetaBySlug,
  getCommentsByBlog,
  addComment,
  likeComment
};

export {};
