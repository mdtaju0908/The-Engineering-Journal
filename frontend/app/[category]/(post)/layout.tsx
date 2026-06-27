import type { Metadata } from 'next';
import '../../globals.css';

export const metadata: Metadata = {
  title: 'The Engineering Journal',
  description:
    'Practical articles on full-stack development, AI engineering, React, Node.js, machine learning, and production software systems.',
};

export default function BlogPostLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 transition-colors duration-300 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
