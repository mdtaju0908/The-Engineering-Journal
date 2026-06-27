const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Blog = require('../models/Blog');
const slugify = require('../utils/slugify');
let marked;
try { marked = require('marked'); } catch { marked = null; }
const SEO_CACHE_FILE = path.join(__dirname, '../.cache/seo-graph.json');
const FRONTEND_ROOT_INDEX = path.join(__dirname, '../../frontend/index.html');
const PUBLIC_DIR = path.join(__dirname, '../../frontend/public');
const PUBLIC_BLOG = path.join(PUBLIC_DIR, 'blog.html');
const PUBLIC_BLOG_POST = path.join(PUBLIC_DIR, 'blog-post.html');
const PUBLIC_FEED = path.join(PUBLIC_DIR, 'feed.xml');
const DEFAULT_DISCOVER_IMAGE = String(process.env.BRAND_OG_IMAGE || '').trim();

function slugifyCategory(cat = 'general') {
  return slugify(cat || 'general');
}

function safeText(s = '') {
  return String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function xmlEscape(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function renderContent(content = '', author = '') {
  const raw = String(content || '');
  if (marked && author === 'AI Agent') {
    try {
      return marked.parse(raw);
    } catch {
      return `<p>${safeText(raw)}</p>`;
    }
  }
  // Assume HTML when not AI Agent
  return raw;
}

function getLargeImageUrl(url = '') {
  if (!url) return DEFAULT_DISCOVER_IMAGE;
  try {
    if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
    const parts = url.split('/upload/');
    return `${parts[0]}/upload/c_fill,g_auto,w_1200,h_675,f_jpg,q_auto:good/${parts[1].replace(/\/v\d+\//, '/')}`;
  } catch {
    return url;
  }
}

function getArticleImageObjects(url = '') {
  if (!url) return undefined;
  try {
    if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) {
      return [{ "@type": "ImageObject", url }];
    }
    const parts = url.split('/upload/');
    const publicId = parts[1].replace(/\/v\d+\//, '/');
    return [
      { "@type": "ImageObject", url: `${parts[0]}/upload/c_fill,g_auto,w_1200,h_675,f_jpg,q_auto:good/${publicId}`, width: 1200, height: 675 },
      { "@type": "ImageObject", url: `${parts[0]}/upload/c_fill,g_auto,w_1200,h_900,f_jpg,q_auto:good/${publicId}`, width: 1200, height: 900 },
      { "@type": "ImageObject", url: `${parts[0]}/upload/c_fill,g_auto,w_1200,h_1200,f_jpg,q_auto:good/${publicId}`, width: 1200, height: 1200 }
    ];
  } catch {
    return [{ "@type": "ImageObject", url }];
  }
}

function buildHtml({ title, description, category, imageUrl, contentHtml, createdAt, updatedAt, slug, views }) {
  const site = 'https://mdtaju.tech';
  const categorySlug = slugifyCategory(category);
  const pageUrl = `${site}/blog-post.html/${categorySlug}/${slug}`;
  const ogImage = getLargeImageUrl(imageUrl || '');
  const metaTitle = `${title} | The Engineering Journal`;
  const metaDesc = (description || title || '').slice(0, 155);
  const dateIso = (createdAt ? new Date(createdAt) : new Date()).toISOString();
  const dateModifiedIso = (updatedAt ? new Date(updatedAt) : (createdAt ? new Date(createdAt) : new Date())).toISOString();
  let siteJsonLd = null;
  try {
    if (fs.existsSync(SEO_CACHE_FILE)) {
      const cached = JSON.parse(fs.readFileSync(SEO_CACHE_FILE, 'utf8'));
      if (cached && cached.jsonLd) siteJsonLd = cached.jsonLd;
    }
  } catch {}
  if (!siteJsonLd) {
    siteJsonLd = {
      "@context":"https://schema.org",
      "@type":"WebSite",
      "@id":"https://mdtaju.tech/#website",
      "name":"Md Taju | Full Stack Developer & AI/ML Engineer",
      "alternateName":["Md Taju","Md Taju Full Stack Developer","Md Taju AI/ML Engineer","mdtaju.tech"],
      "url":`${site}/`
    };
  }
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="UTF-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    '  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">',
    '  <meta name="googlebot" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">',
    '  <meta name="bingbot" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">',
    `  <title>${metaTitle}</title>`,
    `  <meta name="description" content="${metaDesc}">`,
    `  <link rel="canonical" href="${pageUrl}">`,
    '  <meta property="og:type" content="article">',
    `  <meta property="og:title" content="${metaTitle}">`,
    `  <meta property="og:description" content="${metaDesc}">`,
    `  <meta property="og:url" content="${pageUrl}">`,
    ...(ogImage
      ? [
          `  <meta property="og:image" content="${ogImage}">`,
          '  <meta property="og:image:width" content="1200">',
          '  <meta property="og:image:height" content="675">'
        ]
      : []),
    `  <meta property="article:published_time" content="${dateIso}">`,
    `  <meta property="article:modified_time" content="${dateModifiedIso}">`,
    `  <meta property="article:section" content="${safeText(category || 'General')}">`,
    `  <meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}">`,
    `  <meta name="twitter:title" content="${metaTitle}">`,
    `  <meta name="twitter:description" content="${metaDesc}">`,
    ...(ogImage ? [`  <meta name="twitter:image" content="${ogImage}">`] : []),
    '  <link rel="icon" type="image/x-icon" href="/profile-favicon.ico">',
    '  <link rel="apple-touch-icon" sizes="180x180" href="/profile-apple-touch-icon.png">',
    '  <link rel="icon" type="image/png" sizes="32x32" href="/profile-32x32.png">',
    '  <link rel="icon" type="image/png" sizes="16x16" href="/profile-16x16.png">',
    '  <script type="application/ld+json">',
    JSON.stringify(siteJsonLd),
    '  </script>',
    '  <script type="application/ld+json">',
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "@id": `${pageUrl}#article`,
      url: pageUrl,
      headline: title || '',
      description: description || title || '',
      image: getArticleImageObjects(ogImage),
      author: { "@type": "Person", name: "Md Taju", url: site },
      publisher: { "@type": "Organization", name: "Md Taju", logo: { "@type": "ImageObject", url: `${site}/tej-logo-android-chrome-512x512.png`, width: 512, height: 512 } },
      datePublished: dateIso,
      dateModified: dateModifiedIso,
      mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl },
      articleSection: category || 'General',
      interactionStatistic: {
        "@type": "InteractionCounter",
        interactionType: { "@type": "ViewAction" },
        userInteractionCount: Number(views || 0)
      },
      inLanguage: ['en-IN', 'hi-IN'],
      isAccessibleForFree: true
    }),
    '  </script>',
    '  <script type="application/ld+json">',
    JSON.stringify({
      "@context":"https://schema.org",
      "@type":"BreadcrumbList",
      itemListElement:[
        {"@type":"ListItem","position":1,"name":"Home","item":`${site}/`},
        {"@type":"ListItem","position":2,"name":"Blog","item":`${site}/blog.html`},
        {"@type":"ListItem","position":3,"name": (category || 'General'), "item": `${site}/blog-post.html/${categorySlug}/`},
        {"@type":"ListItem","position":4,"name": (title || ''), "item": pageUrl}
      ]
    }),
    '  </script>',
    '  <link rel="preconnect" href="https://fonts.googleapis.com">',
    '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '  <script src="https://cdn.tailwindcss.com"></script>',
    '</head>',
    '<body class="bg-white text-slate-800">',
    '  <main class="max-w-3xl mx-auto px-4 py-8">',
    `    <h1 class="text-4xl font-bold mb-6">${safeText(title || '')}</h1>`,
    imageUrl ? `    <img src="${getLargeImageUrl(imageUrl)}" alt="${safeText(title || '')}" width="1200" height="675" loading="eager" decoding="async" fetchpriority="high" class="w-full rounded-xl mb-8">` : '',
    '    <article class="prose prose-lg">',
    contentHtml,
    '    </article>',
    '  </main>',
    '</body>',
    '</html>'
  ].join('\n');
}

function listHtmlFiles(dir) {
  const files = [];
  function walk(d) {
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.isFile() && ent.name.toLowerCase().endsWith('.html')) files.push(full);
    }
  }
  walk(dir);
  return files;
}

async function loadSeoPayload() {
  try {
    if (fs.existsSync(SEO_CACHE_FILE)) {
      const cached = JSON.parse(fs.readFileSync(SEO_CACHE_FILE, 'utf8'));
      if (cached?.meta && cached?.jsonLd) return cached;
    }
  } catch {
    // ignore cache parse errors and use default payload
  }

  const site = 'https://mdtaju.tech/';
  const meta = {
    title: 'Md Taju | Full Stack Developer & AI/ML Engineer',
    description:
      'Md Taju is a Full Stack Developer and AI/ML Engineer building React, Node.js, machine learning, and scalable web projects.',
    image: DEFAULT_DISCOVER_IMAGE,
    url: site,
    author: 'Md Taju',
    robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    googlebot: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    siteName: 'Md Taju | Full Stack Developer & AI/ML Engineer',
  };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${site}#website`,
        url: site,
        name: meta.siteName,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${site}blog.html?keyword={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'Person',
        '@id': `${site}#person`,
        name: 'Md Taju',
        url: site,
        image: 'https://mdtaju.tech/image.png',
      },
    ],
  };

  return { meta, jsonLd };
}

function replaceOrInsert(headHtml, pattern, replacement, insertAfterTag = '<meta name="author"') {
  if (pattern.test(headHtml)) {
    return headHtml.replace(pattern, replacement);
  }
  const idx = headHtml.indexOf(insertAfterTag);
  if (idx !== -1) {
    const before = headHtml.slice(0, idx);
    const after = headHtml.slice(idx);
    return before + replacement + '\n' + after;
  }
  return replacement + '\n' + headHtml;
}

function injectIntoHtml(html, meta, jsonLd) {
  // Extract <head>...</head>
  const headStart = html.indexOf('<head>');
  const headEnd = html.indexOf('</head>');
  if (headStart === -1 || headEnd === -1) return html; // no head
  let head = html.slice(headStart, headEnd);

  // Replace <title>
  const hasLockedTitle = /<title[^>]*data-lock=["']true["'][^>]*>[\s\S]*?<\/title>/i.test(head);
  if (!hasLockedTitle) {
    head = head.replace(/<title>[\s\S]*?<\/title>/i, `<title>${meta.title || ''}</title>`);
  }
  // Basic metas
  head = head.replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${meta.description || ''}">`);
  head = head.replace(/<meta\s+name=["']author["'][^>]*>/i, `<meta name="author" content="${meta.author || ''}">`);
  head = head.replace(
    /<meta\s+name=["']robots["'][^>]*>/i,
    `<meta name="robots" content="${meta.robots || 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'}">`
  );
  head = replaceOrInsert(
    head,
    /<meta\s+name=["']googlebot["'][^>]*>/i,
    `<meta name="googlebot" content="${meta.googlebot || meta.robots || 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'}">`,
    '<meta name="robots"'
  );
  head = head.replace(/<meta\s+name=["']theme-color["'][^>]*>/i, `<meta name="theme-color" content="#0ea5e9">`);
  head = head.replace(/<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${meta.url || ''}">`);

  // Open Graph
  head = head.replace(/<meta\s+property=["']og:type["'][^>]*>/i, `<meta property="og:type" content="${meta.type || 'website'}">`);
  head = head.replace(/<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${meta.title || ''}">`);
  head = head.replace(/<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${meta.description || ''}">`);
  head = head.replace(/<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${meta.url || ''}">`);
  const hasMetaImage = Boolean(meta.image);
  if (hasMetaImage) {
    head = replaceOrInsert(head, /<meta\s+property=["']og:image["'][^>]*>/i, `<meta property="og:image" content="${meta.image}">`, '<meta property="og:url"');
  } else {
    head = head.replace(/<meta\s+property=["']og:image(?::url|:secure_url|:width|:height|:type|:alt)?["'][^>]*>\s*/gi, '');
    head = head.replace(/<link\s+rel=["']image_src["'][^>]*>\s*/gi, '');
  }
  if (meta.type === 'article') {
    head = replaceOrInsert(head, /<meta\s+property=["']article:published_time["'][^>]*>/i, `<meta property="article:published_time" content="${meta.publishedTime || ''}">`, '<meta property="og:url"');
    head = replaceOrInsert(head, /<meta\s+property=["']article:author["'][^>]*>/i, `<meta property="article:author" content="${meta.author || 'Md Taju'}">`, '<meta property="article:published_time"');
    head = replaceOrInsert(head, /<meta\s+property=["']article:modified_time["'][^>]*>/i, `<meta property="article:modified_time" content="${meta.modifiedTime || meta.publishedTime || ''}">`, '<meta property="article:published_time"');
    head = replaceOrInsert(head, /<meta\s+property=["']article:section["'][^>]*>/i, `<meta property="article:section" content="${meta.section || 'General'}">`, '<meta property="article:author"');
  }

  // Twitter
  head = head.replace(
    /<meta\s+name=["']twitter:card["'][^>]*>/i,
    `<meta name="twitter:card" content="${hasMetaImage ? 'summary_large_image' : 'summary'}">`
  );
  head = head.replace(/<meta\s+name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${meta.title || ''}">`);
  head = head.replace(/<meta\s+name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${meta.description || ''}">`);
  if (hasMetaImage) {
    head = replaceOrInsert(head, /<meta\s+name=["']twitter:image["'][^>]*>/i, `<meta name="twitter:image" content="${meta.image}">`, '<meta name="twitter:description"');
  } else {
    head = head.replace(/<meta\s+name=["']twitter:image(?::alt)?["'][^>]*>\s*/gi, '');
  }

  // Remove existing JSON-LD scripts in head to avoid duplicates
  head = head.replace(/<script\s+type=["']application\/ld\+json["']>[\s\S]*?<\/script>/gi, '');
  // Inject our JSON-LD before </head>
  const ldScript = `\n    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n`;
  head = head + ldScript;

  return html.slice(0, headStart) + head + html.slice(headEnd);
}

async function injectDynamicSeo() {
  const payload = await loadSeoPayload();
  if (!payload || !payload.meta || !payload.jsonLd) {
    console.log('injectDynamicSeo: No SEO payload available, skipping.');
    return;
  }
  const meta = payload.meta;
  const jsonLd = payload.jsonLd;

  const targets = [FRONTEND_ROOT_INDEX];
  // All htmls in public directory
  targets.push(...listHtmlFiles(PUBLIC_DIR));

  let changed = 0;
  for (const file of targets) {
    try {
      if (!fs.existsSync(file)) continue;
      const original = fs.readFileSync(file, 'utf8');
      const updated = injectIntoHtml(original, meta, jsonLd);
      if (updated !== original) {
        fs.writeFileSync(file, updated, 'utf8');
        changed++;
        console.log('SEO injected:', path.relative(path.join(__dirname, '../../'), file));
      }
    } catch (e) {
      console.warn('Failed SEO inject for', file, e.message);
    }
  }
  if (changed === 0) {
    console.log('injectDynamicSeo: No changes made (files may already be up to date).');
  }
}

function toIso(d) {
  try { return new Date(d).toISOString(); } catch { return undefined; }
}

function renderMarkdown(md) {
  const raw = String(md || '');
  if (marked) {
    try { return marked.parse(raw); } catch { /* fallthrough */ }
  }
  return `<p>${safeText(raw)}</p>`;
}

async function fetchBlogs(limit = 10) {
  if (!process.env.MONGO_URI) return [];
  try {
    await connectDB();
    const items = await Blog.find({}).sort({ createdAt: -1 }).limit(limit).lean();
    return items || [];
  } catch {
    return [];
  }
}

function buildFeedXml(blogs = []) {
  const site = (process.env.BRAND_URL || 'https://mdtaju.tech').replace(/\/+$/, '');
  const latestDate = blogs[0]?.updatedAt || blogs[0]?.createdAt || new Date();
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>The Engineering Journal</title>',
    '    <link>https://mdtaju.tech/blog.html</link>',
    '    <description>Technical articles by Md Taju on full-stack development, AI engineering, React, Node.js, and machine learning.</description>',
    '    <language>en-IN</language>',
    `    <lastBuildDate>${new Date(latestDate).toUTCString()}</lastBuildDate>`,
    `    <atom:link href="${site}/feed.xml" rel="self" type="application/rss+xml"/>`
  ];

  blogs.forEach((blog) => {
    const categorySlug = slugifyCategory(blog.category || 'general');
    const loc = `${site}/blog-post.html/${categorySlug}/${blog.slug}`;
    const pubDate = new Date(blog.createdAt || blog.updatedAt || new Date()).toUTCString();
    lines.push('    <item>');
    lines.push(`      <title>${xmlEscape(blog.title || 'Article')}</title>`);
    lines.push(`      <link>${xmlEscape(loc)}</link>`);
    lines.push(`      <guid isPermaLink="true">${xmlEscape(loc)}</guid>`);
    lines.push(`      <description>${xmlEscape(blog.description || blog.title || '')}</description>`);
    lines.push(`      <pubDate>${pubDate}</pubDate>`);
    if (blog.category) lines.push(`      <category>${xmlEscape(blog.category)}</category>`);
    lines.push('    </item>');
  });

  lines.push('  </channel>');
  lines.push('</rss>');
  return lines.join('\n');
}

function writeFeed(blogs = []) {
  fs.writeFileSync(PUBLIC_FEED, buildFeedXml(blogs), 'utf8');
  console.log('Feed written:', path.relative(path.join(__dirname, '../../'), PUBLIC_FEED));
}

async function injectBlogList() {
  const blogs = await fetchBlogs(10);
  if (!fs.existsSync(PUBLIC_BLOG)) return;
  try {
    let html = fs.readFileSync(PUBLIC_BLOG, 'utf8');
    writeFeed(blogs);
    // Inject list into #blog-grid if blogs found
    if (blogs.length) {
      const cards = blogs.map(b => {
        const img = b.coverImage || b.imageUrl || b.image || '';
        const cat = safeText(b.category || 'General');
        const dt = b.createdAt ? new Date(b.createdAt).toISOString().slice(0,10) : '';
        const title = safeText(b.title || '');
        const desc = safeText(b.description || title);
        const catSlug = slugifyCategory(b.category || 'general');
        const url = `/blog-post.html/${catSlug}/${b.slug}`;
        return `
          <article class="group rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 hover:shadow-lg transition-shadow">
            ${img ? `<img src="${img}" alt="${title}" class="w-full h-48 object-cover">` : ''}
            <div class="p-5">
              <div class="flex items-center gap-3 text-xs text-slate-500 mb-2">
                <span class="px-2 py-1 bg-primary/10 text-primary rounded">${cat}</span>
                <span>&bull;</span>
                <time datetime="${dt}">${dt}</time>
              </div>
              <h2 class="text-xl font-bold text-slate-900 dark:text-white mb-2">${title}</h2>
              <p class="text-slate-600 dark:text-slate-400 text-sm mb-4">${desc}</p>
              <a href="${url}" class="inline-flex items-center text-primary hover:underline">Read more</a>
            </div>
          </article>`;
      }).join('\n');
      html = html.replace(
        /<div id="blog-grid"[\s\S]*?>([\s\S]*?)<\/div>/,
        (m) => m.replace(/>([\s\S]*?)<\/div>/, `>${cards}</div>`).replace('hidden', '')
      );
      // Hide loading, error, empty-state
      html = html.replace(/<div id="loading"[\s\S]*?<\/div>/, '<div id="loading" class="hidden"></div>');
      html = html.replace(/<div id="error"[\s\S]*?<\/div>/, '<div id="error" class="hidden"></div>');
      html = html.replace(/<div id="empty-state"[\s\S]*?<\/div>/, '<div id="empty-state" class="hidden"></div>');
    }
    fs.writeFileSync(PUBLIC_BLOG, html, 'utf8');
    console.log('Blog list injected:', path.relative(path.join(__dirname, '../../'), PUBLIC_BLOG));
  } catch (e) {
    console.warn('injectBlogList failed:', e.message);
  }
}

function buildArticleJsonLd(blog, siteMeta) {
  const brandName = process.env.BRAND_NAME || "Md Taju";
  const brandUrl = process.env.BRAND_URL || "https://mdtaju.tech";
  const categorySlug = slugifyCategory(blog.category || 'general');
  const pageUrl = `${brandUrl.replace(/\/+$/, '')}/blog-post.html/${categorySlug}/${blog.slug}`;
  const image = getLargeImageUrl(blog.coverImage || blog.imageUrl || blog.image || siteMeta?.image || '');
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${pageUrl}#article`,
    url: pageUrl,
    headline: blog.title || '',
    description: blog.description || blog.title || '',
    image: getArticleImageObjects(image),
    author: { "@type": "Person", name: blog.author || brandName, url: brandUrl },
    publisher: {
      "@type": "Organization",
      name: brandName,
      logo: { "@type": "ImageObject", url: `${brandUrl.replace(/\/+$/, '')}/tej-logo-android-chrome-512x512.png`, width: 512, height: 512 }
    },
    datePublished: toIso(blog.createdAt) || toIso(new Date()),
    dateModified: toIso(blog.updatedAt) || toIso(blog.createdAt) || toIso(new Date()),
    articleSection: blog.category || 'General',
    keywords: Array.isArray(blog.metaKeywords) ? blog.metaKeywords.join(', ') : undefined,
    interactionStatistic: {
      "@type": "InteractionCounter",
      interactionType: { "@type": "ViewAction" },
      userInteractionCount: Number(blog.views || 0)
    },
    inLanguage: ['en-IN', 'hi-IN'],
    isAccessibleForFree: true,
    mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl }
  };
}

async function injectSingleBlogPost(slug = '') {
  if (!fs.existsSync(PUBLIC_BLOG_POST)) return;
  const blogs = await fetchBlogs(1);
  const blog = Array.isArray(blogs) && blogs.length ? blogs[0] : null;
  if (!blog) {
    console.log('injectSingleBlogPost: no blog found, skipping.');
    return;
  }
  try {
    let html = fs.readFileSync(PUBLIC_BLOG_POST, 'utf8');
    const sitePayload = await loadSeoPayload();
    const siteMeta = sitePayload?.meta || {};
    // Update head meta for article
    const meta = {
      ...siteMeta,
      type: 'article',
      title: blog.title || siteMeta.title,
      description: blog.description || blog.title || siteMeta.description,
      author: blog.author || siteMeta.author || 'Md Taju',
      image: getLargeImageUrl(blog.coverImage || blog.imageUrl || blog.image || siteMeta.image || ''),
      publishedTime: toIso(blog.createdAt) || '',
      modifiedTime: toIso(blog.updatedAt) || toIso(blog.createdAt) || '',
      section: blog.category || 'General',
      url: (function() {
        const brandUrl = process.env.BRAND_URL || "https://mdtaju.tech";
        const categorySlug = slugifyCategory(blog.category || 'general');
        return `${brandUrl.replace(/\/+$/, '')}/blog-post.html/${categorySlug}/${blog.slug}`;
      })()
    };
    html = injectIntoHtml(html, meta, buildArticleJsonLd(blog, siteMeta));
    // Body content injection via ids
    html = html.replace(/id="post-title"[^>]*>[\s\S]*?<\/h1>/, `id="post-title" class="text-4xl md:text-5xl/tight font-bold text-slate-900 dark:text-white font-serif mb-8" itemprop="headline">${safeText(blog.title || '')}</h1>`);
    const dt = blog.createdAt ? new Date(blog.createdAt).toISOString().slice(0,10) : '';
    html = html.replace(/id="post-date"[^>]*>[\s\S]*?<\/span>/, `id="post-date" class="text-slate-500 dark:text-slate-400 text-sm font-medium" itemprop="datePublished">${dt}</span>`);
    html = html.replace(/id="post-category"[^>]*>[\s\S]*?<\/span>/, `id="post-category" class="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase tracking-wider" itemprop="articleSection">${safeText(blog.category || 'General')}</span>`);
    const img = blog.coverImage || blog.imageUrl || blog.image || '';
    html = html.replace(/id="post-image"[^>]*src="[^"]*"/, `id="post-image" src="${img}"`);
    const contentHtml = renderMarkdown(blog.content || blog.description || blog.title);
    html = html.replace(/<div id="post-body"[\s\S]*?id="post-body"[\s\S]*?>[\s\S]*?<\/div>/, `<div id="post-body" class="prose prose-lg dark:prose-invert max-w-none font-serif leading-relaxed markdown-body" itemprop="articleBody">${contentHtml}</div>`);
    // Unhide content block
    html = html.replace(/<article id="content" class="hidden"/, '<article id="content"');
    fs.writeFileSync(PUBLIC_BLOG_POST, html, 'utf8');
    console.log('Blog post injected:', path.relative(path.join(__dirname, '../../'), PUBLIC_BLOG_POST));
  } catch (e) {
    console.warn('injectSingleBlogPost failed:', e.message);
  }
}
async function run() {
  // Always update static HTML SEO first
  await injectDynamicSeo();
  // Inject blog list and a single post fallback
  await injectBlogList();
  await injectSingleBlogPost();

  // Blog SSG only if DB is available
  if (process.env.MONGO_URI) {
    await connectDB();
    const blogs = await Blog.find({}).lean();
    const baseDir = path.join(PUBLIC_DIR, 'blog');
    for (const b of blogs) {
      const categorySlug = slugifyCategory(b.category || 'general');
      const outDir = path.join(baseDir, categorySlug, b.slug);
      fs.mkdirSync(outDir, { recursive: true });
      const contentHtml = renderContent(b.content || '', b.author || '');
      const imageUrl = b.coverImage || b.imageUrl || b.image || '';
      const html = buildHtml({
        title: b.title,
        description: b.description,
        category: b.category,
        imageUrl,
        contentHtml,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        slug: b.slug,
        views: b.views
      });
      fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
      console.log('Generated:', path.join('blog', categorySlug, b.slug, 'index.html'));
    }
    await mongoose.connection.close();
  } else {
    console.log('Skipping blog SSG (no MONGO_URI). Static SEO injection completed.');
  }
}

run().catch((e) => {
  console.error('SSG failed:', e);
  process.exit(1);
});


export {};
