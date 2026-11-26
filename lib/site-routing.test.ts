import { describe, expect, it } from 'vitest';
import {
  decideAppHostRoute,
  decidePortfolioHostRoute,
  isPortfolioHost,
  isPortfolioPath,
  isPublicSitePath,
  isSchedulerHost,
  normalizeHost,
} from './site-routing';

const next = { type: 'next' };
const redirect = (to: string) => ({ type: 'redirect', to });

describe('host matching', () => {
  it('ignores case and port', () => {
    expect(normalizeHost('WWW.RosieQuintana.com:443')).toBe('www.rosiequintana.com');
    expect(isPortfolioHost('RosieQuintana.com')).toBe(true);
    expect(isPortfolioHost('www.rosiequintana.com:443')).toBe(true);
    expect(isSchedulerHost('rosielessons.com')).toBe(true);
  });

  it('treats everything else as neither', () => {
    for (const host of ['localhost:3000', 'my-app-git-branch.vercel.app', 'evilrosiequintana.com', '', null]) {
      expect(isPortfolioHost(host)).toBe(false);
      expect(isSchedulerHost(host)).toBe(false);
    }
  });
});

describe('isPublicSitePath', () => {
  it('allows the portfolio pages, their assets and the contact endpoint', () => {
    for (const path of [
      '/',
      '/coaching',
      '/coaching/',
      '/media',
      '/site/files/rosie-quintana-resume.pdf',
      '/api/contact',
      '/sitemap.xml',
      '/robots.txt',
    ]) {
      expect(isPublicSitePath(path), path).toBe(true);
    }
  });

  it('keeps scheduler pages and look-alike paths private', () => {
    for (const path of [
      '/schedule',
      '/admin',
      '/lessons',
      '/dashboard',
      '/api/lessons',
      '/api/contacts',
      '/api/contact-export',
      '/media-admin',
      '/coaching/secret',
      '/site',
      '/sitemap.xml.bak',
    ]) {
      expect(isPublicSitePath(path), path).toBe(false);
    }
  });
});

describe('isPortfolioPath', () => {
  it('covers the acting pages but not the lessons page', () => {
    for (const path of ['/', '/media', '/media/', '/api/contact', '/site/hero.jpg', '/sitemap.xml']) {
      expect(isPortfolioPath(path), path).toBe(true);
    }
    for (const path of ['/coaching', '/coaching/', '/schedule', '/login']) {
      expect(isPortfolioPath(path), path).toBe(false);
    }
  });
});

describe('decidePortfolioHostRoute', () => {
  const schedulerOrigin = 'https://rosielessons.com';

  it('serves the acting pages', () => {
    for (const pathname of ['/', '/media', '/api/contact', '/site/hero.jpg']) {
      expect(decidePortfolioHostRoute({ pathname, schedulerOrigin })).toEqual(next);
    }
  });

  it('forwards the lessons page to the lessons domain', () => {
    expect(decidePortfolioHostRoute({ pathname: '/coaching', schedulerOrigin })).toEqual(
      redirect('https://rosielessons.com/coaching')
    );
  });

  it('sends scheduler pages to the scheduler domain, keeping path and query', () => {
    expect(decidePortfolioHostRoute({ pathname: '/schedule', schedulerOrigin })).toEqual(
      redirect('https://rosielessons.com/schedule')
    );
    expect(
      decidePortfolioHostRoute({ pathname: '/login', search: '?message=hi', schedulerOrigin })
    ).toEqual(redirect('https://rosielessons.com/login?message=hi'));
    expect(decidePortfolioHostRoute({ pathname: '/admin/students', schedulerOrigin })).toEqual(
      redirect('https://rosielessons.com/admin/students')
    );
  });

  it('leaves framework requests alone', () => {
    expect(decidePortfolioHostRoute({ pathname: '/_next/data/build/index.json', schedulerOrigin })).toEqual(next);
  });
});

describe('decideAppHostRoute', () => {
  it('keeps the scheduler domain root opening login for signed-out visitors', () => {
    expect(decideAppHostRoute({ host: 'rosielessons.com', pathname: '/', signedIn: false })).toEqual(
      redirect('/login')
    );
  });

  it('shows the portfolio at the root on preview URLs and localhost', () => {
    for (const host of ['localhost:3000', 'my-app-git-branch.vercel.app']) {
      expect(decideAppHostRoute({ host, pathname: '/', signedIn: false })).toEqual(next);
    }
  });

  it('forwards signed-in users from the root to the dashboard', () => {
    for (const host of ['rosielessons.com', 'localhost:3000']) {
      expect(decideAppHostRoute({ host, pathname: '/', signedIn: true })).toEqual(redirect('/dashboard'));
    }
  });

  it('lets signed-out visitors read the public pages on any host', () => {
    for (const pathname of ['/coaching', '/media', '/api/contact', '/site/files/x.pdf', '/robots.txt']) {
      expect(decideAppHostRoute({ host: 'rosielessons.com', pathname, signedIn: false })).toEqual(next);
    }
  });

  it('still requires a session for scheduler pages', () => {
    for (const pathname of ['/schedule', '/admin', '/lessons', '/dashboard', '/api/lessons', '/api/students']) {
      expect(decideAppHostRoute({ host: 'rosielessons.com', pathname, signedIn: false })).toEqual(
        redirect('/login')
      );
    }
  });

  it('keeps the paths that never needed a session open', () => {
    for (const pathname of ['/login', '/login/forgot-password', '/auth/callback', '/api/cron/send-reminders', '/api/webhooks/resend']) {
      expect(decideAppHostRoute({ host: 'rosielessons.com', pathname, signedIn: false })).toEqual(next);
    }
  });

  it('does not interfere with signed-in navigation', () => {
    for (const pathname of ['/schedule', '/admin', '/coaching', '/api/lessons']) {
      expect(decideAppHostRoute({ host: 'rosielessons.com', pathname, signedIn: true })).toEqual(next);
    }
  });
});
