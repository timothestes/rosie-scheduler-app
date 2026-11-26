import { site } from '../_content/site';

export default function SiteFooter() {
  return (
    <footer className="border-t border-rq-rule">
      <div className="mx-auto flex max-w-[90rem] flex-wrap items-end justify-between gap-x-12 gap-y-8 px-5 py-10 sm:px-16">
        <figure className="max-w-xl">
          <blockquote className="text-[1.0625rem] leading-relaxed text-rq-ink">
            “Stories make us more alive, more human, more courageous, more loving.”
          </blockquote>
          <figcaption className="rq-label mt-2">Madeleine L’Engle</figcaption>
        </figure>

        <div className="flex flex-col gap-3 text-sm">
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
      </div>
    </footer>
  );
}
