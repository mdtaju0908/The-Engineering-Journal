import createMDX from '@next/mdx';
import type { NextConfig } from 'next';

const backendOrigin = (
  process.env.BACKEND_ORIGIN ||
  process.env.NEXT_PUBLIC_API_ORIGIN ||
  'http://localhost:5000'
).replace(/\/+$/, '');

const nextConfig: NextConfig = {
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
  async redirects() {
    return [
      {
        source: '/blog',
        destination: '/',
        permanent: true,
      },
      {
        source: '/blog/:category/:slug',
        destination: '/:category/:slug',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendOrigin}/api/:path*`,
      },
      {
        source: '/ws',
        destination: `${backendOrigin}/ws`,
      },
      {
        source: '/ws/:path*',
        destination: `${backendOrigin}/ws/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
};

const withMDX = createMDX({
  extension: /\.mdx?$/,
});

export default withMDX(nextConfig);
