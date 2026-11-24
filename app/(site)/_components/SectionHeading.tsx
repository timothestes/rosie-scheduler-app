import Link from 'next/link';

export function SectionHeading({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="font-display text-[clamp(2.5rem,6vw,4.25rem)] leading-none text-rq-ink">
      {children}
    </h2>
  );
}

const arrowLinkClass =
  'group inline-flex items-baseline gap-2 text-[0.8rem] font-medium uppercase tracking-[0.2em] text-rq-accent';

/** A quiet "go further" link; `download` and off-site links render a plain <a>. */
export function ArrowLink({
  href,
  children,
  download,
}: {
  href: string;
  children: React.ReactNode;
  download?: boolean;
}) {
  const content = (
    <>
      <span className="underline decoration-rq-accent/40 underline-offset-[0.4em] transition-colors group-hover:decoration-rq-accent">
        {children}
      </span>
      <span aria-hidden="true" className="transition-transform duration-300 ease-out group-hover:translate-x-1">
        {download ? '↓' : '→'}
      </span>
    </>
  );

  if (download || !href.startsWith('/') || href.startsWith('/site/')) {
    return (
      <a href={href} download={download} className={arrowLinkClass}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={arrowLinkClass}>
      {content}
    </Link>
  );
}
