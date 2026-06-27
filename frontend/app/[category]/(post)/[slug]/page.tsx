'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, notFound } from 'next/navigation';
import {
  Sun,
  Moon,
  Eye,
  Heart,
  Share2,
  Bookmark,
  Mail,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';
import {
  getBlogBySlug,
  getCommentsByBlog,
  addComment,
  likeComment,
  incrementView,
  reactToBlog,
  getBlogs,
  getViewWebSocketUrl,
} from '@/lib/api';
import type { Blog, Comment } from '@/lib/types';
import { timeAgo, getLargeImageUrl, extractYouTubeId, slugify } from '@/lib/utils';
import { getArticlePath } from '@/lib/routes';

export default function BlogPostPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [blog, setBlog] = useState<Blog | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [relatedPosts, setRelatedPosts] = useState<Blog[]>([]);
  const [commentName, setCommentName] = useState('');
  const [commentContent, setCommentContent] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [likes, setLikes] = useState(0);
  const [views, setViews] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // Theme toggle
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    setIsDark(initialDark);
    if (initialDark) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    if (newDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // Scroll progress
  useEffect(() => {
    const handleScroll = () => {
      const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
      setScrollProgress(scrolled);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Markdown setup
  useEffect(() => {
    marked.setOptions({
      breaks: true,
      gfm: true,
    });
  }, []);

  // Code highlighting
  useEffect(() => {
    if (blog && contentRef.current) {
      contentRef.current.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block as HTMLElement);
      });
    }
  }, [blog]);

  // Fetch blog
  useEffect(() => {
    const fetchBlog = async () => {
      try {
        setLoading(true);
        const data = await getBlogBySlug(slug);
        setBlog(data);
        setLikes(data.likes);
        setViews(data.views);

        try {
          const viewData = await incrementView(slug);
          if (Number.isFinite(Number(viewData.views))) {
            setViews(Number(viewData.views));
          }
        } catch (viewErr) {
          console.error('Failed to increment view:', viewErr);
        }

        const allBlogs = await getBlogs({ pageSize: 100 });
        const related = allBlogs.blogs
          .filter((b) => b._id !== data._id && b.category === data.category)
          .slice(0, 3);
        setRelatedPosts(related);
      } catch {
        setError('Blog not found');
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchBlog();
    }
  }, [slug]);

  // View WebSocket
  useEffect(() => {
    if (!slug) return;

    let ws: WebSocket | null = null;
    let closed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      const wsUrl = getViewWebSocketUrl(slug);
      if (!wsUrl || closed) return;

      try {
        ws = new WebSocket(wsUrl);
        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.type === 'view:update' && payload.slug === slug.toLowerCase()) {
              setViews(Number(payload.views || 0));
            }
          } catch (err) {
            console.error('View socket parse error:', err);
          }
        };
        ws.onclose = () => {
          if (!closed) {
            retryTimer = setTimeout(connect, 3000);
          }
        };
      } catch (err) {
        console.error('View socket connection error:', err);
      }
    };

    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (ws) ws.close();
    };
  }, [slug]);

  // Fetch comments
  useEffect(() => {
    const fetchComments = async () => {
      if (!blog) return;
      try {
        setCommentsLoading(true);
        const data = await getCommentsByBlog(blog._id);
        setComments(data.comments);
      } catch (err) {
        console.error('Failed to fetch comments:', err);
      } finally {
        setCommentsLoading(false);
      }
    };

    if (blog) {
      fetchComments();
    }
  }, [blog]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blog || !commentName.trim() || !commentContent.trim()) return;

    try {
      setSubmittingComment(true);
      const data = await addComment(blog._id, commentName.trim(), commentContent.trim());
      setComments((prev) => [data.comment, ...prev]);
      setCommentName('');
      setCommentContent('');
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!blog) return;
    try {
      const data = await likeComment(blog._id, commentId);
      setComments((prev) =>
        prev.map((c) => (c._id === commentId ? { ...c, likes: data.likes } : c))
      );
    } catch (err) {
      console.error('Failed to like comment:', err);
    }
  };

  const handleReactToBlog = async () => {
    if (!blog || hasLiked) return;
    try {
      const data = await reactToBlog(blog._id);
      setLikes(data.likes);
      setHasLiked(true);
    } catch (err) {
      console.error('Failed to react to blog:', err);
    }
  };

  const handleShare = () => {
    if (navigator.share && blog) {
      navigator.share({
        title: blog.title,
        text: blog.description,
        url: window.location.href,
      });
    }
  };

  if (loading) {
    return (
      <div className="pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="lg:w-[68%] xl:w-[70%] max-w-3xl mx-auto">
          <div className="flex flex-col items-center justify-center py-32">
            <div className="loader ease-linear rounded-full border-4 border-t-4 border-slate-200 h-12 w-12 mb-4" />
            <p className="text-slate-500 animate-pulse font-medium">Loading Article...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !blog) {
    notFound();
  }

  const html = blog.content ? DOMPurify.sanitize(marked.parse(blog.content) as string) : '';
  const youtubeId = extractYouTubeId(blog.youtubeUrl || '');
  const articleUrl = getArticlePath(slugify(blog.category), blog.slug);

  // Generate table of contents
  const headings = contentRef.current ? Array.from(contentRef.current.querySelectorAll('h2, h3')) : [];

  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: blog.title,
            description: blog.description,
            image: getLargeImageUrl(blog.coverImage || blog.imageUrl || blog.image),
            author: {
              '@type': 'Person',
              name: blog.author,
            },
            publisher: {
              '@type': 'Organization',
              name: 'The Engineering Journal',
              logo: {
                '@type': 'ImageObject',
                url: '/tej-logo-android-chrome-512x512.png',
              },
            },
            mainEntityOfPage: articleUrl,
            datePublished: blog.createdAt,
            dateModified: blog.updatedAt || blog.createdAt,
          }),
        }}
      />

      {/* Scroll Progress */}
      <div
        className="fixed top-0 left-0 h-1 bg-primary z-[60] transition-all duration-100"
        style={{ width: `${scrollProgress}%` }}
      />

      {/* Navbar */}
      <nav className="fixed w-full z-50 bg-white/95 dark:bg-dark/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 grid grid-cols-[auto_1fr_auto] sm:grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="justify-self-start inline-flex items-center text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              <span className="font-medium hidden sm:inline">All Articles</span>
            </Link>
            <Link
              href="/"
              className="justify-self-center max-w-[58vw] sm:max-w-none truncate text-sm sm:text-lg font-bold font-serif text-slate-900 dark:text-white text-center leading-tight"
            >
              <span className="text-primary">The Engineering Journal</span>
            </Link>
            <button
              onClick={toggleTheme}
              className="justify-self-end p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto min-h-screen relative flex flex-col lg:flex-row gap-8 lg:gap-16">
        {/* Left: Main Article */}
        <div className="lg:w-[68%] xl:w-[70%] max-w-3xl mx-auto lg:mx-0 w-full">
          <article itemScope itemType="https://schema.org/BlogPosting">
            {/* Header */}
            <header className="mb-10">
              <div className="flex items-center gap-3 mb-6">
                <span
                  className="text-primary text-sm font-bold uppercase tracking-widest"
                  itemProp="articleSection"
                >
                  {blog.category}
                </span>
              </div>
              <h1
                className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl font-bold text-slate-900 dark:text-white font-serif mb-6 sm:mb-8 leading-[1.2]"
                itemProp="headline"
              >
                {blog.title}
              </h1>

              {/* Author & Meta */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 py-6 border-y border-slate-200 dark:border-slate-800/60 mb-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Image
                      src="/tej-logo.svg"
                      alt="Author"
                      width={48}
                      height={48}
                      className="w-8 h-8 object-contain"
                    />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white" itemProp="author" itemScope itemType="https://schema.org/Person">
                      <span itemProp="name">{blog.author}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                      <span>5 min read</span>
                      <span>&middot;</span>
                      <span itemProp="datePublished">{timeAgo(blog.createdAt)}</span>
                    </div>
                  </div>
                </div>
                {/* Quick Actions */}
                <div className="flex items-center gap-5 text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5 text-sm font-medium" title="Views">
                    <Eye className="w-4 h-4" />
                    <span className="count">{views.toLocaleString()}</span>
                  </div>
                  <button
                    className="hover:text-primary transition-colors"
                    title="Save Bookmark"
                    aria-label="Save bookmark"
                    aria-pressed="false"
                  >
                    <Bookmark className="w-5 h-5" />
                  </button>
                  <button
                    className="hover:text-primary transition-colors"
                    title="Share"
                    onClick={handleShare}
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </header>

            {/* Featured Image */}
            <div className="mb-12 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 shadow-sm">
              <Image
                src={getLargeImageUrl(blog.coverImage || blog.imageUrl || blog.image)}
                alt={blog.title}
                width={1200}
                height={675}
                className="w-full h-auto max-h-[500px] object-cover"
                itemProp="image"
                priority
              />
            </div>

            {/* Optional Video */}
            {youtubeId && (
              <section className="mb-12">
                <div className="rounded-2xl overflow-hidden bg-black aspect-video shadow-sm">
                  <iframe
                    src={`https://www.youtube.com/embed/${youtubeId}`}
                    title={blog.title}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              </section>
            )}

            {blog.videoUrl && !youtubeId && (
              <section className="mb-12">
                <div className="rounded-2xl overflow-hidden bg-black shadow-sm">
                  <video
                    src={blog.videoUrl}
                    className="w-full h-auto max-h-[650px]"
                    controls
                    playsInline
                    preload="metadata"
                  />
                </div>
              </section>
            )}

            {/* Content Body */}
            <div
              ref={contentRef}
              className="prose prose-lg md:prose-xl dark:prose-invert max-w-none font-serif leading-relaxed markdown-body text-slate-800 dark:text-slate-300"
              itemProp="articleBody"
              dangerouslySetInnerHTML={{ __html: html }}
            />

            {/* Tags */}
            {blog.metaKeywords && blog.metaKeywords.length > 0 && (
              <div className="mt-12 pt-8 flex flex-wrap gap-3 border-t border-slate-200 dark:border-slate-800/60">
                {blog.metaKeywords.map((tag) => (
                  <span
                    key={tag}
                    className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 rounded-full text-sm font-medium cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Reactions / Engagement */}
            <div className="mt-8 py-6 border-y border-slate-200 dark:border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <button
                  onClick={handleReactToBlog}
                  disabled={hasLiked}
                  className={`flex items-center gap-3 px-6 py-3 rounded-full border transition-all ${
                    hasLiked
                      ? 'border-red-200 dark:border-red-900 text-red-500'
                      : 'border-slate-300 dark:border-slate-700 hover:border-primary hover:text-primary'
                  }`}
                >
                  <Heart className={`w-5 h-5 ${hasLiked ? 'fill-current' : ''}`} />
                  <span className="font-medium">{likes} Reactions</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 dark:text-slate-400 mr-2">Share:</span>
                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </button>
                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                  </svg>
                </button>
                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </button>
                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <Mail className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Discussion Section */}
            <section className="mt-12 sm:mt-16 bg-slate-50 dark:bg-slate-800/30 rounded-3xl p-4 sm:p-7 border border-slate-100 dark:border-slate-800/50">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 font-serif">
                Discussion <span className="text-slate-400 text-lg font-normal ml-2">({comments.length})</span>
              </h3>

              {/* Comment Input */}
              <form onSubmit={handleSubmitComment} className="mb-8">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm p-2 flex-shrink-0">
                    <Image
                      src="/tej-logo.svg"
                      alt="The Engineering Journal"
                      width={48}
                      height={48}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="grid grid-cols-1 sm:grid-cols-3 items-start gap-3">
                      <input
                        id="comment-name"
                        type="text"
                        maxLength={80}
                        placeholder="Your name"
                        value={commentName}
                        onChange={(e) => setCommentName(e.target.value)}
                        className="sm:col-span-1 w-full h-12 self-start bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all dark:text-white placeholder-slate-400 shadow-sm"
                      />
                      <textarea
                        id="comment-content"
                        rows={4}
                        maxLength={2000}
                        placeholder="What are your thoughts?"
                        value={commentContent}
                        onChange={(e) => setCommentContent(e.target.value)}
                        className="sm:col-span-2 w-full min-h-[120px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all dark:text-white placeholder-slate-400 resize-none shadow-sm"
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mt-3 gap-3">
                      <p id="comment-form-status" className="text-xs text-slate-500 dark:text-slate-400 min-h-[16px] order-2 sm:order-1" />
                      <button
                        id="comment-submit-btn"
                        type="submit"
                        disabled={submittingComment || !commentName.trim() || !commentContent.trim()}
                        className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold rounded-full hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors shadow-sm order-1 sm:order-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {submittingComment ? 'Posting...' : 'Respond'}
                      </button>
                    </div>
                  </div>
                </div>
              </form>

              <div className="space-y-8">
                {commentsLoading ? (
                  <div className="animate-pulse space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700" />
                        <div className="flex-1">
                          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32 mb-2" />
                          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full mb-1" />
                          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : comments.length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400 mt-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-3">
                    No discussion yet. Be the first to share your thoughts.
                  </div>
                ) : (
                  comments.map((comment) => (
                    <div key={comment._id} className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="w-5 h-5 text-slate-400" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-slate-900 dark:text-white text-sm">
                            {comment.name}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {timeAgo(comment.createdAt)}
                          </span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 text-sm mb-2">
                          {comment.content}
                        </p>
                        <button
                          onClick={() => handleLikeComment(comment._id)}
                          className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-primary transition-colors"
                        >
                          <Heart className="w-3 h-3" />
                          <span>{comment.likes}</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Related Articles */}
            {relatedPosts.length > 0 && (
              <section className="mt-20 pt-10 border-t border-slate-200 dark:border-slate-800/60">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-8 font-serif">
                  More from The Engineering Journal
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                  {relatedPosts.map((post) => (
                    <Link
                      key={post._id}
                      href={getArticlePath(slugify(post.category), post.slug)}
                      className="group"
                    >
                      <article className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 hover:shadow-lg transition-all">
                        <div className="relative h-40 overflow-hidden">
                          <Image
                            src={getLargeImageUrl(post.coverImage || post.imageUrl || post.image)}
                            alt={post.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                        <div className="p-5">
                          <h4 className="font-semibold text-slate-900 dark:text-white mb-2 group-hover:text-primary transition-colors line-clamp-2">
                            {post.title}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {timeAgo(post.createdAt)}
                          </p>
                        </div>
                      </article>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </article>
        </div>

        {/* Right: Sticky Sidebar */}
        <aside className="hidden md:block lg:w-[32%] xl:w-[30%] shrink-0">
          <div className="sticky top-28 space-y-8">
            {/* Author Card */}
            <div className="bg-slate-50 dark:bg-slate-800/30 rounded-3xl p-8 border border-slate-100 dark:border-slate-800/50 flex flex-col items-center text-center">
              <Image
                src="/tej-logo.svg"
                alt="Md Taju logo"
                width={96}
                height={96}
                className="w-24 h-24 mb-5 object-contain"
              />
              <h3 className="font-bold text-slate-900 dark:text-white text-xl mb-2 font-serif">Md Taju</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                Full Stack Developer and AI/ML Engineer building practical products and sharing real engineering insights.
              </p>
              <div className="w-full grid grid-cols-4 gap-2">
                <a
                  href="https://www.linkedin.com/in/md-taju0908/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                  className="h-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-primary transition-colors shadow-sm"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6.94 8.5H3.56V20h3.38V8.5zM5.25 7.06a1.97 1.97 0 110-3.94 1.97 1.97 0 010 3.94zM20.44 20h-3.37v-5.604c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.46-2.14 2.95V20H9.7V8.5h3.23v1.57h.04c.45-.85 1.55-1.75 3.2-1.75 3.42 0 4.05 2.25 4.05 5.17V20z" />
                  </svg>
                </a>
                <a
                  href="https://github.com/mdtaju0908"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub"
                  className="h-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-primary transition-colors shadow-sm"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 .5a12 12 0 00-3.79 23.39c.6.11.82-.26.82-.58v-2.05c-3.34.73-4.04-1.61-4.04-1.61-.55-1.38-1.33-1.74-1.33-1.74-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.39 1.24-3.24-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.24a11.5 11.5 0 016 0c2.29-1.56 3.3-1.24 3.3-1.24.66 1.65.24 2.87.12 3.17.77.85 1.24 1.93 1.24 3.24 0 4.62-2.8 5.65-5.48 5.95.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57A12 12 0 0012 .5z" />
                  </svg>
                </a>
                <a
                  href="https://x.com/md_taju0908/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="X"
                  className="h-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-primary transition-colors shadow-sm"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.9 2H22l-6.77 7.74L23 22h-6.26l-4.9-6.4L6.24 22H3.1l7.73-8.27L1 2h6.4l4.43 5.84L18.9 2zm-1.1 18h1.73L6.46 3.9H4.6L17.8 20z" />
                  </svg>
                </a>
                <a
                  href="mailto:contact@mdtaju.tech"
                  aria-label="Email"
                  className="h-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-primary transition-colors shadow-sm"
                >
                  <Mail className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Table of Contents */}
            {headings.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800/80 p-8 shadow-sm">
                <h3 className="font-bold text-slate-900 dark:text-white mb-5 uppercase tracking-widest text-xs">
                  Table of Contents
                </h3>
                <nav className="text-sm text-slate-600 dark:text-slate-400 space-y-3 font-medium">
                  {headings.map((heading, idx) => (
                    <a
                      key={idx}
                      href={`#${heading.id}`}
                      className={`block hover:text-primary transition-colors ${
                        heading.tagName === 'H3' ? 'pl-4' : ''
                      }`}
                    >
                      {heading.textContent}
                    </a>
                  ))}
                </nav>
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* Footer */}
      <footer className="bg-slate-50 dark:bg-black/40 py-8 border-t border-slate-200 dark:border-slate-800 text-center">
        <p className="text-slate-500 text-sm">
          &copy; 2026 The Engineering Journal. All rights reserved.
        </p>
      </footer>

      <style jsx global>{`
        .loader {
          border-top-color: #0ea5e9;
          animation: spinner 1.5s linear infinite;
        }
        @keyframes spinner {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        .markdown-body h1 {
          font-size: 2rem;
          margin-top: 1.5rem;
          margin-bottom: 1rem;
        }
        .markdown-body h2 {
          font-size: 1.75rem;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .markdown-body h3 {
          font-size: 1.5rem;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
        }
        .markdown-body p {
          margin-top: 1rem;
          margin-bottom: 1rem;
          line-height: 1.8;
        }
        .markdown-body ul,
        .markdown-body ol {
          padding-left: 1.5rem;
          margin-top: 1rem;
          margin-bottom: 1rem;
        }
        .markdown-body blockquote {
          border-left: 4px solid #0ea5e9;
          padding-left: 1rem;
          color: #64748b;
        }
        .dark .markdown-body blockquote {
          color: #94a3b8;
        }
        .markdown-body pre {
          background: #0b1220;
          color: #e6edf3;
          padding: 1rem;
          border-radius: 0.75rem;
          overflow-x: auto;
        }
        .markdown-body code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
        }
        .dark .markdown-body pre {
          background: #0b1220;
        }
      `}</style>
    </div>
  );
}
