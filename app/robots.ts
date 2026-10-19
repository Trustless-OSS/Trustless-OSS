import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://www.trustless-oss.xyz';

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/leaderboard', '/support', '/connect', '/login'],
        disallow: ['/dashboard', '/profile', '/auth/', '/api/', '/*.json$', '/*.tsx$', '/_next/'],
      },
      {
        userAgent: 'Googlebot',
        allow: ['/', '/leaderboard', '/support', '/connect', '/login'],
        disallow: ['/dashboard', '/profile', '/auth/', '/api/'],
      },
      {
        userAgent: 'Bingbot',
        allow: ['/', '/leaderboard', '/support', '/connect', '/login'],
        disallow: ['/dashboard', '/profile', '/auth/', '/api/'],
      },
      // Rate limiting for aggressive crawlers
      {
        userAgent: ['AhrefsBot', 'SemrushBot', 'DotBot'],
        crawlDelay: 10,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
