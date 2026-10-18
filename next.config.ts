import type { NextConfig } from 'next';
import { DOCS_URL } from './lib/links';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.9'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/docs',
        destination: DOCS_URL,
        permanent: true,
      },
      {
        source: '/dashboard/profile',
        destination: '/profile',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
