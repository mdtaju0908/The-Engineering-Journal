import type { MetadataRoute } from 'next';
import { ARTICLE_CATEGORIES, STATIC_PAGES } from '@/lib/routes';
import type { Blog } from '@/lib/types';
import { slugify } from '@/lib/utils';
import { buildServerApiUrl, SITE_ORIGIN } from '@/lib/apiConfig';

const BLOG_FETCH_TIMEOUT_MS = 5000;

async function getLatestBlogs() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BLOG_FETCH_TIMEOUT_MS);

  try {
    const searchParams = new URLSearchParams({ pageNumber: '1', pageSize: '100' });
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const blogs = await getLatestBlogs();
  const now = new Date();

  return [
    {
      url: `${SITE_ORIGIN}/`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },
    ...ARTICLE_CATEGORIES.map((category) => ({
      url: `${SITE_ORIGIN}/${category.slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
    ...STATIC_PAGES.map((page) => ({
      url: `${SITE_ORIGIN}/${page.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
    ...blogs.map((blog) => ({
      url: `${SITE_ORIGIN}/${slugify(blog.category)}/${blog.slug}`,
      lastModified: new Date(blog.updatedAt || blog.createdAt || now),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}
