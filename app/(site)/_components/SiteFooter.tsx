import Image from 'next/image';
import { site } from '../_content/site';

// Fixed light-on-dark colours: this band sits on a photograph in both themes.
export default function SiteFooter() {
  return (
    <footer className="relative isolate overflow-hidden bg-[#1d1115] text-[#fff0ec]">
      <Image
        src="/site/photos/hunchback-1.jpg"
        alt=""
        fill
        sizes="100vw"
        className="-z-10 object-cover object-[50%_30%] opacity-35"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#1d1115] via-[#1d1115]/70 to-[#1d1115]/40" />

      <div className="mx-auto max-w-7xl px-6 pb-10 pt-24 sm:px-10 sm:pt-32">
        <figure className="max-w-3xl">
          <blockquote className="font-display text-[clamp(1.75rem,4vw,3rem)] leading-[1.15]">
            “Stories make us more alive, more human, more courageous, more loving.”
          </blockquote>
          <figcaption className="mt-5 text-sm uppercase tracking-[0.2em] text-[#fff0ec]/80">
            Madeleine L’Engle
          </figcaption>
        </figure>

        <div className="mt-20 flex flex-wrap items-end justify-between gap-x-10 gap-y-6 border-t border-[#fff0ec]/25 pt-6 text-sm">
          <ul className="flex flex-wrap gap-x-7 gap-y-2">
            {site.social.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="uppercase tracking-[0.2em] underline-offset-4 hover:underline"
                >
                  {link.label}
                </a>
              </li>
            ))}
            <li>
              <a href={`mailto:${site.email}`} className="uppercase tracking-[0.2em] underline-offset-4 hover:underline">
                Email
              </a>
            </li>
          </ul>
          <p className="text-[#fff0ec]/80">
            © {new Date().getFullYear()} {site.name}
            <span aria-hidden="true"> · </span>
            <a href={site.loginHref} className="underline-offset-4 hover:underline">
              Student login
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
