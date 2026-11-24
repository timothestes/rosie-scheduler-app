import Link from 'next/link';
import { site } from '../_content/site';

const nav = [
  { label: 'About', href: '/#about' },
  { label: 'Media', href: '/media' },
  { label: 'Coaching', href: '/coaching' },
  { label: 'Contact', href: '/#contact' },
];

export default function SiteHeader() {
  return (
    <header className="border-b border-rq-ink/15">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-10 gap-y-3 px-6 py-5 sm:px-10">
        <Link
          href="/"
          className="font-display text-2xl uppercase tracking-[0.18em] text-rq-ink transition-colors hover:text-rq-accent"
        >
          {site.name}
        </Link>

        <nav aria-label="Main" className="flex flex-wrap items-center gap-x-7 gap-y-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[0.8rem] font-medium uppercase tracking-[0.2em] text-rq-ink transition-colors hover:text-rq-accent"
            >
              {item.label}
            </Link>
          ))}
          <a
            href={site.bookingHref}
            className="border border-rq-accent px-4 py-2 text-[0.8rem] font-medium uppercase tracking-[0.2em] text-rq-accent transition-colors hover:bg-rq-accent hover:text-rq-on-accent"
          >
            Book a lesson
          </a>
        </nav>
      </div>
    </header>
  );
}
