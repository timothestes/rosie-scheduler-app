import Link from 'next/link';
import { site } from '../_content/site';

const navLink = 'text-[0.9375rem] font-medium text-rq-ink underline-offset-4 hover:underline';

export default function SiteHeader() {
  return (
    <header className="border-b border-rq-rule">
      <div className="mx-auto flex min-h-[4.5rem] max-w-[90rem] flex-wrap items-center justify-between gap-x-8 gap-y-2 px-5 py-3 sm:px-12">
        <Link href="/" className="rq-display text-[1.625rem] tracking-[0.04em] text-rq-ink">
          {site.name}
        </Link>

        <nav aria-label="Main" className="flex flex-wrap items-center gap-x-7 gap-y-1">
          <Link href="/#about" className={navLink}>
            About
          </Link>
          <Link href="/media" className={navLink}>
            Media
          </Link>
          <a href={site.files.resume} className={navLink}>
            Resume
          </a>
          <Link href="/#contact" className={navLink}>
            Contact
          </Link>
        </nav>
      </div>
    </header>
  );
}
