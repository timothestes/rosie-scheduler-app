import Link from 'next/link';

export function SectionHeading({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="rq-display text-[2.75rem]">
      {children}
    </h2>
  );
}

/**
 * A quiet "go further" link. `tone="house"` is for the dark band. Downloads and
 * links that leave the acting pages render a plain <a>.
 */
export function ArrowLink({
  href,
  children,
  download,
  tone = 'paper',
}: {
  href: string;
  children: React.ReactNode;
  download?: boolean;
  tone?: 'paper' | 'house';
}) {
  const className = `group inline-flex items-baseline gap-2 text-[0.9375rem] font-semibold underline underline-offset-4 decoration-1 hover:decoration-2 ${
    tone === 'house' ? 'text-rq-house-ink' : 'text-rq-ink'
  }`;
  const content = (
    <>
      {children}
      <span aria-hidden="true" className="transition-transform duration-200 ease-out group-hover:translate-x-0.5">
        {download ? '↓' : '→'}
      </span>
    </>
  );

  if (download || !href.startsWith('/') || href.startsWith('/site/')) {
    return (
      <a href={href} download={download} className={className}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}
