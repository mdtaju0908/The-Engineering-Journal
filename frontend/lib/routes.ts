export const ARTICLE_CATEGORIES = [
  { label: 'Articles', slug: 'articles' },
  { label: 'Tutorials', slug: 'tutorials' },
  { label: 'AI & ML', slug: 'ai-ml' },
  { label: 'Full Stack', slug: 'full-stack' },
  { label: 'Projects', slug: 'projects' },
  { label: 'Student Life', slug: 'student-life' },
  { label: 'Engineering Notes', slug: 'engineering-notes' },
];

export const STATIC_PAGES = [
  { label: 'About', slug: 'about' },
  { label: 'Newsletter', slug: 'newsletter' },
];

export function getArticlePath(categorySlug: string, articleSlug: string) {
  return `/${categorySlug}/${articleSlug}`;
}

export function getCategoryLabel(slug: string) {
  return ARTICLE_CATEGORIES.find((category) => category.slug === slug)?.label || 'All';
}

