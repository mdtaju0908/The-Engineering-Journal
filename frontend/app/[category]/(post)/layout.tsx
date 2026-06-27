import type { Metadata } from 'next';

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
  return children;
}
