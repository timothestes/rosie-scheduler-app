import type { MetadataRoute } from 'next';
import { PORTFOLIO_ORIGIN } from '@/lib/site-routing';

// Only the acting portfolio is listed. Lessons live on the scheduler's own domain.
export default function sitemap(): MetadataRoute.Sitemap {
  return ['/', '/media'].map((path) => ({
    url: `${PORTFOLIO_ORIGIN}${path === '/' ? '' : path}`,
    changeFrequency: 'monthly',
    priority: path === '/' ? 1 : 0.8,
  }));
}
