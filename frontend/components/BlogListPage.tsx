'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, Eye, Clock, BookOpen, ChevronRight } from 'lucide-react';
import { getBlogs } from '@/lib/api';
import type { Blog } from '@/lib/types';
import { timeAgo, slugify, getLargeImageUrl } from '@/lib/utils';
import { getArticlePath } from '@/lib/routes';

const HERO_SUBTITLE_LINES = [
  'Exploring the intersection of AI and software engineering.',
  'Practical tutorials on full-stack web development.',
  'Thoughts on cloud architecture and scalability.',
  'Learning out loud, one commit at a time.',
];

type BlogListPageProps = {
  initialCategory?: string;
};

export function BlogListPage({ initialCategory = 'All' }: BlogListPageProps) {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<string[]>(['All']);
  const [visibleCount, setVisibleCount] = useState(12);
  const [typingText, setTypingText] = useState('');
  useEffect(() => {
    let lineIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timer: NodeJS.Timeout;

    const tick = () => {
      const currentLine = HERO_SUBTITLE_LINES[lineIndex];

      if (!deleting) {
        charIndex += 1;
        setTypingText(currentLine.slice(0, charIndex));

        if (charIndex >= currentLine.length) {
          deleting = true;
          timer = setTimeout(tick, 4500);
          return;
        }
      } else {
        charIndex -= 1;
        setTypingText(currentLine.slice(0, charIndex));

        if (charIndex === 0) {
          deleting = false;
          lineIndex = (lineIndex + 1) % HERO_SUBTITLE_LINES.length;
        }
      }

      const speed = deleting ? 30 : 60 + Math.random() * 40;
      timer = setTimeout(tick, speed);
    };

    timer = setTimeout(tick, 100);

    return () => clearTimeout(timer);
  }, []);

  const fetchBlogs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getBlogs({
        pageNumber: 1,
        pageSize: 100,
        keyword: searchQuery,
        category: activeCategory,
      });
      setBlogs(data.blogs);

      if (searchQuery === '') {
        const cats = Array.from(new Set(data.blogs.map((b) => b.category).filter(Boolean)));
        setCategories(['All', ...cats]);
      }
    } catch {
      setError('Failed to load blogs');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, activeCategory]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBlogs();
  }, [fetchBlogs]);

  const handleLoadMore = () => {
    setVisibleCount((prev) => Math.min(prev + 6, blogs.length));
  };

  const displayedBlogs = blogs.slice(0, visibleCount);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="animate-pulse">
          <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded w-64 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-6">
                <div className="h-48 bg-slate-200 dark:bg-slate-700 rounded-xl mb-4" />
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-3" />
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full mb-2" />
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center py-20 bg-red-50 dark:bg-red-900/20 rounded-2xl">
          <p className="text-red-600 dark:text-red-400 font-medium mb-4">{error}</p>
          <button
            onClick={fetchBlogs}
            className="px-6 py-2 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 rounded-lg hover:shadow-lg transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Blog',
            name: 'The Engineering Journal',
            url: '/',
            description:
              'Practical articles on full-stack development, AI engineering, React, Node.js, machine learning, and production software systems.',
          }),
        }}
      />
      <header className="mb-12 text-center md:text-left">
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4 font-serif">
          Latest Insights
        </h1>
        <p className="text-slate-600 dark:text-slate-400 font-light mx-auto md:mx-0 h-6">
          <span>{typingText}</span>
          <span className="animate-pulse">|</span>
        </p>
      </header>

      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
        {/* Main Content */}
        <div className="lg:w-2/3">
          {blogs.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                No articles found
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-xs mx-auto">
                We couldn&apos;t find any articles matching your filters.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory('All');
                }}
                className="px-5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {displayedBlogs.map((blog) => (
                  <Link
                    key={blog._id}
                    href={getArticlePath(slugify(blog.category), blog.slug)}
                    className="group"
                  >
                    <article className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 hover:shadow-xl transition-all duration-300">
                      <div className="relative h-48 overflow-hidden">
                        <Image
                          src={getLargeImageUrl(blog.coverImage || blog.imageUrl || blog.image)}
                          alt={blog.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <div className="p-6">
                        <span className="inline-block px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-full mb-3">
                          {blog.category}
                        </span>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3 group-hover:text-primary transition-colors font-serif">
                          {blog.title}
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400 text-sm mb-4 line-clamp-2">
                          {blog.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {timeAgo(blog.createdAt)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Eye className="w-4 h-4" />
                            {blog.views} views
                          </div>
                        </div>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>

              {visibleCount < blogs.length && (
                <div className="text-center">
                  <button
                    onClick={handleLoadMore}
                    className="inline-flex items-center gap-2 px-6 py-3 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-full hover:border-primary hover:text-primary transition-all"
                  >
                    Load More Articles
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar */}
        <aside className="lg:w-1/3 space-y-8">
          {/* Search */}
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white mb-3 font-serif">Search</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all dark:text-white"
              />
            </div>
          </div>

          {/* Categories */}
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white mb-3 font-serif">Categories</h3>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    activeCategory === cat
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Popular Articles */}
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white mb-4 font-serif">
              Popular on TEJ
            </h3>
            <div className="space-y-4">
              {blogs
                .sort((a, b) => b.views - a.views)
                .slice(0, 5)
                .map((blog) => (
                  <Link
                    key={blog._id}
                    href={getArticlePath(slugify(blog.category), blog.slug)}
                    className="flex gap-3 group"
                  >
                    <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
                      <Image
                        src={getLargeImageUrl(blog.coverImage || blog.imageUrl || blog.image)}
                        alt={blog.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2 group-hover:text-primary transition-colors">
                        {blog.title}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {timeAgo(blog.createdAt)}
                      </p>
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
