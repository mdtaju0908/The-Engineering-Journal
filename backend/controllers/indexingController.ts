const fs = require('fs');
const path = require('path');
const https = require('https');

const DEFAULT_DISCOVER_IMAGE = String(process.env.BRAND_OG_IMAGE || 'https://mdtaju.tech/image.png').trim();

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

function xmlEscape(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toAbsoluteUrl(url = '', origin = 'https://mdtaju.tech') {
  const value = String(url || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  return `${origin.replace(/\/+$/, '')}/${value.replace(/^\/+/, '')}`;
}

function buildSitemapXml() {
  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">');
  const now = new Date().toISOString().slice(0, 10);
  const pushUrl = (loc, lastmod, changefreq, priority, image) => {
    lines.push('  <url>');
    lines.push(`    <loc>${xmlEscape(loc)}</loc>`);
    lines.push(`    <xhtml:link rel="alternate" hreflang="en-in" href="${xmlEscape(loc)}" />`);
    lines.push(`    <xhtml:link rel="alternate" hreflang="en" href="${xmlEscape(loc)}" />`);
    lines.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(loc)}" />`);
    if (lastmod) lines.push(`    <lastmod>${lastmod}</lastmod>`);
    if (changefreq) lines.push(`    <changefreq>${changefreq}</changefreq>`);
    if (priority) lines.push(`    <priority>${priority}</priority>`);
    const imageLoc = toAbsoluteUrl(image);
    if (imageLoc) {
      lines.push('    <image:image>');
      lines.push(`      <image:loc>${xmlEscape(imageLoc)}</image:loc>`);
      lines.push('    </image:image>');
    }
    lines.push('  </url>');
  };
  pushUrl('https://mdtaju.tech/', now, 'weekly', '1.0', DEFAULT_DISCOVER_IMAGE);
  pushUrl('https://mdtaju.tech/qualifications', now, 'monthly', '0.9', DEFAULT_DISCOVER_IMAGE);
  pushUrl('https://mdtaju.tech/achievements', now, 'monthly', '0.8', DEFAULT_DISCOVER_IMAGE);
  pushUrl('https://mdtaju.tech/github', now, 'weekly', '0.8', DEFAULT_DISCOVER_IMAGE);
  pushUrl('https://mdtaju.tech/projects', now, 'weekly', '0.9', DEFAULT_DISCOVER_IMAGE);
  pushUrl('https://mdtaju.tech/gallery', now, 'monthly', '0.7', DEFAULT_DISCOVER_IMAGE);
  pushUrl('https://mdtaju.tech/resume', now, 'monthly', '0.8', DEFAULT_DISCOVER_IMAGE);
  pushUrl('https://mdtaju.tech/contact', now, 'monthly', '0.8', DEFAULT_DISCOVER_IMAGE);
  pushUrl('https://mdtaju.tech/about', now, 'monthly', '0.7', DEFAULT_DISCOVER_IMAGE);
  pushUrl('https://mdtaju.tech/services', now, 'monthly', '0.8', DEFAULT_DISCOVER_IMAGE);
  pushUrl('https://mdtaju.tech/feedback', now, 'monthly', '0.4', '');
  lines.push('</urlset>');
  return lines.join('\n');
}

function ping(url) {
  return new Promise((resolve) => {
    try {
      https
        .get(url, (res) => {
          res.resume();
          resolve(true);
        })
        .on('error', () => resolve(false));
    } catch (_) {
      resolve(false);
    }
  });
}

async function rebuildSitemap() {
  const xml = buildSitemapXml();
  const sitemapPath = path.join(__dirname, '../../frontend/public/sitemap.xml');
  fs.writeFileSync(sitemapPath, xml, 'utf8');
  return true;
}

async function pingSearchEngines() {
  const sitemapUrl = encodeURIComponent('https://mdtaju.tech/sitemap.xml');
  await ping(`https://www.google.com/ping?sitemap=${sitemapUrl}`);
  await ping(`https://www.bing.com/ping?sitemap=${sitemapUrl}`);
}

async function refresh(req, res) {
  try {
    await rebuildSitemap();
    await pingSearchEngines();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}

module.exports = {
  refresh,
  rebuildSitemap,
  pingSearchEngines
};

export {};
