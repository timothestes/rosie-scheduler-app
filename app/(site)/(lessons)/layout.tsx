import type { Metadata } from 'next';
import { PORTFOLIO_ORIGIN, SCHEDULER_ORIGIN } from '@/lib/site-routing';
import { site } from '../_content/site';

// The lessons page lives on the scheduler's domain (rosielessons.com), apart
// from the acting portfolio. rosiequintana.com/coaching forwards here.
export const metadata: Metadata = {
  metadataBase: new URL(SCHEDULER_ORIGIN),
  openGraph: {
    type: 'website',
    siteName: 'Voice lessons with Rosie Quintana',
    images: [{ url: '/site/coaching/smile.jpg', width: 1200, height: 1026, alt: 'Rosie Quintana smiling' }],
  },
};

const navLink = 'text-[0.9375rem] font-medium text-rq-ink underline-offset-4 hover:underline';

export default function LessonsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-rq-rule">
        <div className="mx-auto flex min-h-[4.5rem] max-w-[90rem] flex-wrap items-center justify-between gap-x-8 gap-y-2 px-5 py-3 sm:px-12">
          <a href={site.lessonsHref} className="flex flex-wrap items-baseline gap-x-3 text-rq-ink">
            <span className="rq-display text-[1.625rem] tracking-[0.04em]">{site.name}</span>
            <span className="rq-label">Voice lessons</span>
          </a>

          <nav aria-label="Main" className="flex flex-wrap items-center gap-x-7 gap-y-2">
            <a href={PORTFOLIO_ORIGIN} className={navLink}>
              Acting site
            </a>
            <a href={site.loginHref} className={navLink}>
              Student login
            </a>
            <a href={site.bookingHref} className="rq-button rq-button-solid">
              Book a lesson
            </a>
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-rq-rule">
        <div className="mx-auto flex max-w-[90rem] flex-wrap items-center justify-between gap-x-12 gap-y-4 px-5 py-8 text-sm sm:px-16">
          <ul className="flex flex-wrap gap-x-6 gap-y-1">
            {site.social.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-rq-ink underline-offset-4 hover:underline"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <p className="text-rq-muted">
            © {new Date().getFullYear()} {site.name}
          </p>
        </div>
      </footer>
    </>
  );
}
