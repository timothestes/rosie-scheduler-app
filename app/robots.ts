import type { MetadataRoute } from 'next';
import { PORTFOLIO_ORIGIN } from '@/lib/site-routing';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/', '/auth/', '/dashboard', '/lessons', '/login', '/schedule'],
    },
    sitemap: `${PORTFOLIO_ORIGIN}/sitemap.xml`,
  };
}
