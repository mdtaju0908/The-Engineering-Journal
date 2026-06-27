const BOT_RE =
  /facebookexternalhit|facebot|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|slackbot|pinterest|snapchat|instagram|tiktok|mastodon|bufferbot|outbrain|flipboard|embedly|quora|vkshare|skypeuripreview|redditbot|googlebot|googleother|google-inspectiontool|bingbot|bingpreview|yandexbot|baiduspider|duckduckbot|applebot|iframely|lighthouse|pagespeed|gtmetrix|viber|line|kakaotalk|wechat|tumblr|yahoo|slurp|ia_archiver|alexabot|pingdom|uptimerobot|screaming frog|ahrefsbot|semrushbot|dotbot|rogerbot|metainspector/i;

const SITE_ORIGIN = String(process.env.NEXT_PUBLIC_SITE_ORIGIN || 'https://the-engineering-journal.mdtaju.tech').replace(/\/+$/, '');
const BACKEND_ORIGIN = String(
  process.env.BACKEND_ORIGIN ||
    process.env.NEXT_PUBLIC_API_ORIGIN ||
    (process.env.NODE_ENV === 'development' ? 'https://the-engineering-journal.onrender.com' : SITE_ORIGIN)
).replace(/\/+$/, '');
const PUBLIC_API_BASE = String(process.env.NEXT_PUBLIC_API_BASE || '').trim();
const SERVER_API_BASE = String(
  process.env.BACKEND_API_BASE ||
    (/^https?:\/\//i.test(PUBLIC_API_BASE) ? PUBLIC_API_BASE : '') ||
    `${BACKEND_ORIGIN}/api`
).replace(/\/+$/, '');
const DEFAULT_IMAGE = `${SITE_ORIGIN}/tej-logo-android-chrome-512x512.png`;

export const config = {
  matcher: ['/', '/blog', '/blog/:category/:slug', '/:category/:slug'],
};

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function compactText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function truncate(value = '', maxLength = 180) {
  const text = compactText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function isBotHtmlRequest(request: Request) {
  const userAgent = request.headers.get('user-agent') || '';
  if (!BOT_RE.test(userAgent)) return false;

  const accept = request.headers.get('accept') || '';
  return !accept || accept.includes('text/html') || accept.includes('*/*');
}

function toAbsoluteUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  return `${SITE_ORIGIN}/${raw.replace(/^\/+/g, '')}`;
}

function getImageUrl(value = '') {
  const absolute = toAbsoluteUrl(value || DEFAULT_IMAGE);
  try {
    if (!absolute.includes('res.cloudinary.com') || !absolute.includes('/upload/')) {
      return absolute;
    }

    const [base, rest] = absolute.split('/upload/');
    return `${base}/upload/c_fill,g_auto,w_1200,h_675,f_jpg,q_auto/${rest.replace(/\/v\d+\//, '/')}`;
  } catch {
    return absolute;
  }
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

function safeJsonLd(jsonLd: Record<string, unknown>) {
  return JSON.stringify(jsonLd).replace(/</g, '\\u003c');
}

function buildMetaHtml({
  title,
  description,
  canonicalUrl,
  imageUrl,
  imageAlt,
  ogType = 'website',
  jsonLd,
}: {
  title: string;
  description: string;
  canonicalUrl: string;
  imageUrl?: string;
  imageAlt?: string;
  ogType?: string;
  jsonLd?: Record<string, unknown>;
}) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeCanonical = escapeHtml(canonicalUrl);
  const safeImage = escapeHtml(getImageUrl(imageUrl || DEFAULT_IMAGE));
  const safeAlt = escapeHtml(imageAlt || `${title} preview image`);
  const imageMimeType = escapeHtml(inferImageMimeType(safeImage));

  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    '  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">',
    '  <meta name="googlebot" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">',
    `  <title>${safeTitle}</title>`,
    `  <meta name="description" content="${safeDescription}">`,
    `  <link rel="canonical" href="${safeCanonical}">`,
    `  <meta property="og:type" content="${escapeHtml(ogType)}">`,
    '  <meta property="og:locale" content="en_IN">',
    '  <meta property="og:site_name" content="The Engineering Journal">',
    `  <meta property="og:url" content="${safeCanonical}">`,
    `  <meta property="og:title" content="${safeTitle}">`,
    `  <meta property="og:description" content="${safeDescription}">`,
    `  <meta property="og:image" content="${safeImage}">`,
    `  <meta property="og:image:url" content="${safeImage}">`,
    `  <meta property="og:image:secure_url" content="${safeImage}">`,
    '  <meta property="og:image:width" content="1200">',
    '  <meta property="og:image:height" content="675">',
    `  <meta property="og:image:type" content="${imageMimeType}">`,
    `  <meta property="og:image:alt" content="${safeAlt}">`,
    `  <link rel="image_src" href="${safeImage}">`,
    '  <meta name="twitter:card" content="summary_large_image">',
    `  <meta name="twitter:url" content="${safeCanonical}">`,
    `  <meta name="twitter:title" content="${safeTitle}">`,
    `  <meta name="twitter:description" content="${safeDescription}">`,
    `  <meta name="twitter:image" content="${safeImage}">`,
    `  <meta name="twitter:image:alt" content="${safeAlt}">`,
    jsonLd ? `  <script type="application/ld+json">${safeJsonLd(jsonLd)}</script>` : '',
    '</head>',
    '<body></body>',
    '</html>',
  ].join('\n');
}

function htmlResponse(html: string, maxAgeSeconds = 900) {
  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': `public, s-maxage=${maxAgeSeconds}, stale-while-revalidate=86400`,
    },
  });
}

async function fetchJson(url: string) {
  try {
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function buildServerApiUrl(path: string, params?: URLSearchParams) {
  const normalizedPath = String(path || '').replace(/^\/+/, '');
  const query = params && params.toString() ? `?${params.toString()}` : '';
  return `${SERVER_API_BASE}/${normalizedPath}${query}`;
}

type BlogPreview = {
  success?: boolean;
  title?: string;
  description?: string;
  content?: string;
  coverImage?: string;
  imageUrl?: string;
  image?: string;
};

function blogListMeta(latestBlog?: BlogPreview) {
  const image = latestBlog
    ? latestBlog.coverImage || latestBlog.imageUrl || latestBlog.image
    : DEFAULT_IMAGE;

  return buildMetaHtml({
    title: 'The Engineering Journal',
    description:
      'Practical articles on full-stack development, AI engineering, React, Node.js, machine learning, and production software systems.',
    canonicalUrl: `${SITE_ORIGIN}/`,
    imageUrl: image,
    imageAlt: latestBlog?.title ? `${latestBlog.title} cover image` : 'The Engineering Journal preview image',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'The Engineering Journal',
      url: `${SITE_ORIGIN}/`,
      description:
        'Practical articles on full-stack development, AI engineering, React, Node.js, machine learning, and production software systems.',
    },
  });
}

async function blogPostMeta(requestUrl: URL) {
  const slug = requestUrl.pathname.split('/').filter(Boolean).pop() || '';
  if (!slug) return blogListMeta();

  const blog = await fetchJson(buildServerApiUrl(`blogs/slug/${encodeURIComponent(slug)}`));
  if (!blog || blog.success === false) return blogListMeta();

  const title = compactText(blog.title || 'Article');
  const description = truncate(blog.description || blog.content || 'Read this article on The Engineering Journal.', 220);
  const image = blog.coverImage || blog.imageUrl || blog.image || DEFAULT_IMAGE;

  const canonicalPath = requestUrl.pathname.startsWith('/blog/')
    ? `/${requestUrl.pathname.split('/').filter(Boolean).slice(1).join('/')}`
    : requestUrl.pathname;

  return buildMetaHtml({
    title: `${title} | The Engineering Journal`,
    description,
    canonicalUrl: `${SITE_ORIGIN}${canonicalPath}`,
    imageUrl: image,
    imageAlt: `${title} cover image`,
    ogType: 'article',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title,
      description,
      image,
      mainEntityOfPage: `${SITE_ORIGIN}${canonicalPath}`,
      datePublished: blog.createdAt,
      dateModified: blog.updatedAt || blog.createdAt,
    },
  });
}

export default async function proxy(request: Request) {
  if (!isBotHtmlRequest(request)) return undefined;

  const url = new URL(request.url);
  const pathname = url.pathname.toLowerCase().replace(/\/+$/, '') || '/';

  if (pathname === '/' || pathname === '/blog') {
    const searchParams = new URLSearchParams({ pageNumber: '1', pageSize: '1' });
    const payload = await fetchJson(buildServerApiUrl('blogs', searchParams));
    const latestBlog = Array.isArray(payload?.blogs) ? payload.blogs[0] : undefined;
    return htmlResponse(blogListMeta(latestBlog), 900);
  }

  const segments = pathname.split('/').filter(Boolean);

  if (pathname.startsWith('/blog/') || segments.length === 2) {
    return htmlResponse(await blogPostMeta(url), 1800);
  }

  return undefined;
}
