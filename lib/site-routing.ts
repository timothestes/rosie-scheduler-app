// Routing rules for serving two things from one deployment:
//
//  - Rosie's public portfolio (Home, Coaching, Media), which is what
//    rosiequintana.com shows, and
//  - the lesson scheduler, which lives at rosielessons.com and is where every
//    login, auth callback and booking link is configured to land.
//
// Pure functions only (no Next.js or Supabase imports) so the proxy can call
// them and vitest can cover them.

/** Hosts that show the portfolio and nothing else. */
export const PORTFOLIO_HOSTS = ['rosiequintana.com', 'www.rosiequintana.com'];

/** Canonical origin for the portfolio (metadata, sitemap). */
export const PORTFOLIO_ORIGIN = 'https://www.rosiequintana.com';

/** The scheduler's own production hosts. */
export const SCHEDULER_HOSTS = ['rosielessons.com', 'www.rosielessons.com'];

/** Where scheduler pages are sent when requested on a portfolio host. */
export const SCHEDULER_ORIGIN = (
  process.env.NEXT_PUBLIC_APP_URL || 'https://rosielessons.com'
).replace(/\/+$/, '');

/** Signed-in users land here; it forwards to /admin or /schedule by role. */
export const DASHBOARD_PATH = '/dashboard';

// Exact paths anyone may request: the pages, the contact endpoint, SEO files.
const PUBLIC_PATHS = ['/', '/coaching', '/media', '/api/contact', '/sitemap.xml', '/robots.txt'];
// Everything in public/site (photos are skipped by the proxy matcher, PDFs are not).
const PUBLIC_ASSET_PREFIX = '/site/';

// Paths that never required a session, before the portfolio existed.
const AUTH_FREE_PREFIXES = ['/login', '/auth', '/api/cron', '/api/webhooks'];

export type RouteDecision =
  | { type: 'next' }
  | { type: 'redirect'; to: string };

const NEXT: RouteDecision = { type: 'next' };

export function normalizeHost(host: string | null | undefined): string {
  return (host ?? '').trim().toLowerCase().replace(/:\d+$/, '');
}

export function isPortfolioHost(host: string | null | undefined): boolean {
  return PORTFOLIO_HOSTS.includes(normalizeHost(host));
}

export function isSchedulerHost(host: string | null | undefined): boolean {
  return SCHEDULER_HOSTS.includes(normalizeHost(host));
}

function stripTrailingSlash(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

/** Pages and files anyone may see without signing in. */
export function isPublicSitePath(pathname: string): boolean {
  return (
    PUBLIC_PATHS.includes(stripTrailingSlash(pathname)) || pathname.startsWith(PUBLIC_ASSET_PREFIX)
  );
}

/**
 * Decision for a request on a portfolio host, where nobody is ever signed in:
 * portfolio pages are served, everything else belongs to the scheduler.
 */
export function decidePortfolioHostRoute(input: {
  pathname: string;
  search?: string;
  schedulerOrigin?: string;
}): RouteDecision {
  const { pathname, search = '', schedulerOrigin = SCHEDULER_ORIGIN } = input;
  // Framework internals (RSC payloads, chunks) are served from whichever host asked.
  if (isPublicSitePath(pathname) || pathname.startsWith('/_next/')) return NEXT;
  return { type: 'redirect', to: `${schedulerOrigin}${pathname}${search}` };
}

/** Decision for a request on the scheduler's host, a preview URL or localhost. */
export function decideAppHostRoute(input: {
  host: string | null | undefined;
  pathname: string;
  signedIn: boolean;
}): RouteDecision {
  const { host, pathname, signedIn } = input;
  const isRoot = stripTrailingSlash(pathname) === '/';

  if (signedIn) {
    // The root used to forward signed-in users to their page; keep doing that.
    return isRoot ? { type: 'redirect', to: DASHBOARD_PATH } : NEXT;
  }

  // On the scheduler's own domain the root keeps opening the login page, as
  // it always has. Preview URLs and localhost show the portfolio there.
  if (isRoot && isSchedulerHost(host)) return { type: 'redirect', to: '/login' };

  if (isPublicSitePath(pathname)) return NEXT;
  if (AUTH_FREE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return NEXT;

  return { type: 'redirect', to: '/login' };
}
