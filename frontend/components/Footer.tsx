import Link from 'next/link';
import Image from 'next/image';
import { Rss } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3 mb-1">
              <div className="w-8 h-8 relative">
                <Image
                  src="/tej-logo.svg"
                  alt="Logo"
                  fill
                  className="object-contain"
                />
              </div>
              <span className="font-serif font-bold text-lg text-slate-900 dark:text-white">
                The Engineering Journal
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-light">
              &copy; {new Date().getFullYear()} All rights reserved.
            </p>
          </div>

          <div className="flex items-center gap-4 text-sm font-medium text-slate-600 dark:text-slate-300">
            <Link
              href="/"
              className="hover:text-primary transition-colors"
            >
              Articles
            </Link>
            <Link
              href="/feed.xml"
              className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
            >
              <Rss className="w-4 h-4" />
              RSS
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
