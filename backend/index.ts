require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const path = require('path');

const connectDB = require('./config/db');
const blogRoutes = require('./routes/blogRoutes');
const agentRoutes = require('./routes/agentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const configRoutes = require('./routes/configRoutes');
const { protect, admin } = require('./middleware/authMiddleware');
const { sendBlogNotificationById } = require('./controllers/notificationController');
const { refresh } = require('./controllers/indexingController');
const { createViewSocketHub } = require('./realtime/viewSocketHub');
const { createAgentSocketHub } = require('./realtime/agentSocketHub');
const { agentEvents } = require('./events/agentEvents');

if (process.env.ENABLE_AGENT_CRON !== 'false') {
  try {
    require('./cron/blogAgentCron');
  } catch (error) {
    console.warn('Blog cron scheduling unavailable:', error.message);
  }
}

connectDB();

const app = express();
app.disable('x-powered-by');

const toOrigin = (value) => {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch (_) {
    return null;
  }
};

const allowedOrigins = [
  'https://the-engineering-journal.mdtaju.tech',
  'https://the-engineering-journal.onrender.com',
  'http://localhost:5000',
  'http://localhost:3000',
  toOrigin(process.env.BLOG_CLIENT_URL),
  toOrigin(process.env.CLIENT_URL),
  toOrigin(process.env.BRAND_URL)
].filter(Boolean);

const allowedHosts = allowedOrigins
  .map((origin) => {
    try {
      return new URL(origin).host.toLowerCase();
    } catch (_) {
      return '';
    }
  })
  .filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  try {
    const parsed = new URL(origin);
    const host = parsed.host.toLowerCase();
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    return allowedHosts.some((allowedHost) => host === allowedHost || host.endsWith(`.${allowedHost}`));
  } catch (_) {
    return false;
  }
};

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: {
    maxAge: 63072000,
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

app.use(cors({
  origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'X-Device-Id',
    'X-Device-Type',
    'X-Device-Os',
    'X-Device-Browser',
    'X-View-Session'
  ]
}));

app.use((req, res, next) => {
  res.setHeader(
    'X-Robots-Tag',
    'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
  );
  res.setHeader('Content-Language', 'en-IN');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=()');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  next();
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => {
  res.json({ success: true, service: 'blogger' });
});

app.use('/api/blogs', blogRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/config', configRoutes);
app.post('/api/admin/blogs/:id/send-notification', protect, admin, sendBlogNotificationById);
app.post('/api/indexing/refresh', protect, admin, refresh);

const FRONTEND_URL = process.env.BLOG_CLIENT_URL || 'https://the-engineering-journal.mdtaju.tech';

app.get('/', (_req, res) => res.redirect(302, FRONTEND_URL));
app.get('/blog.html', (_req, res) => res.redirect(301, FRONTEND_URL));
app.get('/blog-post.html', (_req, res) => res.redirect(301, FRONTEND_URL));
app.get('/blog-post.html/:category/:slug', (req, res) => {
  const { category, slug } = req.params;
  res.redirect(301, `${FRONTEND_URL}/${category}/${slug}`);
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ success: false, message: 'Not found' });
    return;
  }
  // Redirect all non-API requests to frontend
  res.redirect(302, FRONTEND_URL);
});

app.use((err, _req, res, _next) => {
  console.error('Blogger error:', err.stack || err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.BLOGGER_PORT || process.env.PORT || 5000;
const server = http.createServer(app);

const viewSocketHub = createViewSocketHub(server, {
  path: '/ws',
  isOriginAllowed: isAllowedOrigin
});
app.set('viewSocketHub', viewSocketHub);

const agentSocketHub = createAgentSocketHub(server, {
  path: '/ws/agent',
  isOriginAllowed: isAllowedOrigin
});
app.set('agentSocketHub', agentSocketHub);

agentEvents.on('status', (payload) => {
  agentSocketHub.broadcast({
    ...payload,
    type: 'agent:status',
    level: payload.type,
    ts: new Date().toISOString()
  });
});

server.listen(PORT, () => {
  console.log(`Blogger web running on port ${PORT}`);
});

export {};
