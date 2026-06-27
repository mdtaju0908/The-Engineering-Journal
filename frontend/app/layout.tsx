import type { Metadata } from 'next';
import './globals.css';
import { AgentWidget } from '@/components/AgentWidget';
import { SITE_ORIGIN } from '@/lib/apiConfig';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: 'The Engineering Journal',
    template: '%s | The Engineering Journal',
  },
  description:
    'Practical articles on full-stack development, AI engineering, React, Node.js, machine learning, and production software systems.',
  icons: {
    icon: [
      { url: '/tej-logo-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/tej-logo-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/tej-logo-apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'icon', url: '/tej-logo-favicon.ico' },
    ],
  },
  manifest: '/site.webmanifest',
  openGraph: {
    title: 'The Engineering Journal',
    description:
      'Practical articles on full-stack development, AI engineering, React, Node.js, machine learning, and production software systems.',
    url: 'https://the-engineering-journal.mdtaju.tech',
    siteName: 'The Engineering Journal',
    locale: 'en_IN',
    type: 'website',
    images: [
      {
        url: '/tej-logo-android-chrome-512x512.png',
        width: 512,
        height: 512,
        alt: 'The Engineering Journal Logo',
      },
      {
        url: '/tej-logo-android-chrome-192x192.png',
        width: 192,
        height: 192,
        alt: 'The Engineering Journal Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Engineering Journal',
    description:
      'Practical articles on full-stack development, AI engineering, React, Node.js, machine learning, and production software systems.',
    images: ['/tej-logo-android-chrome-512x512.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const savedTheme = localStorage.getItem('theme');
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              })();
            `
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 transition-colors duration-300 font-sans antialiased">
        {children}
        <AgentWidget />
      </body>
    </html>
  );
}
