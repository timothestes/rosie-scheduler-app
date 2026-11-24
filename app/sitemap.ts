import type { MetadataRoute } from 'next';
import { PORTFOLIO_ORIGIN } from '@/lib/site-routing';

// Only the public portfolio is listed; the scheduler's pages all need a login.
export default function sitemap(): MetadataRoute.Sitemap {
  return ['/', '/coaching', '/media'].map((path) => ({
    url: `${PORTFOLIO_ORIGIN}${path === '/' ? '' : path}`,
    changeFrequency: 'monthly',
    priority: path === '/' ? 1 : 0.8,
  }));
}
