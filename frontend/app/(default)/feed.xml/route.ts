import { ARTICLE_CATEGORIES } from '@/lib/routes';
import type { Blog } from '@/lib/types';
import { slugify } from '@/lib/utils';
import { buildServerApiUrl, SITE_ORIGIN } from '@/lib/apiConfig';

const BLOG_FETCH_TIMEOUT_MS = 5000;

function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function getLatestBlogs() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BLOG_FETCH_TIMEOUT_MS);

  try {
    const searchParams = new URLSearchParams({ pageNumber: '1', pageSize: '50' });
    const response = await fetch(buildServerApiUrl('blogs', searchParams), {
      next: { revalidate: 900 },
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload.blogs) ? (payload.blogs as Blog[]) : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  const blogs = await getLatestBlogs();
  const updated = blogs[0]?.updatedAt || blogs[0]?.createdAt || new Date().toISOString();

  const items = blogs
    .map((blog) => {
      const url = `${SITE_ORIGIN}/${slugify(blog.category)}/${blog.slug}`;
      return [
        '<item>',
        `  <title>${escapeXml(blog.title)}</title>`,
        `  <link>${escapeXml(url)}</link>`,
        `  <guid>${escapeXml(url)}</guid>`,
        `  <description>${escapeXml(blog.description)}</description>`,
        `  <category>${escapeXml(blog.category)}</category>`,
        `  <pubDate>${new Date(blog.createdAt).toUTCString()}</pubDate>`,
        '</item>',
      ].join('\n');
    })
    .join('\n');

  const categoryLinks = ARTICLE_CATEGORIES.map(
    (category) => `<atom:link rel="section" href="${SITE_ORIGIN}/${category.slug}" title="${escapeXml(category.label)}" />`
  ).join('\n');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '<channel>',
    '  <title>The Engineering Journal</title>',
    `  <link>${SITE_ORIGIN}/</link>`,
    '  <description>Practical engineering articles, tutorials, and project notes.</description>',
    `  <lastBuildDate>${new Date(updated).toUTCString()}</lastBuildDate>`,
    `  <atom:link href="${SITE_ORIGIN}/feed.xml" rel="self" type="application/rss+xml" />`,
    categoryLinks,
    items,
    '</channel>',
    '</rss>',
  ].join('\n');

  return new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, s-maxage=900, stale-while-revalidate=86400',
    },
  });
}
