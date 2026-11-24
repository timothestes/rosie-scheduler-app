import type { Metadata } from 'next';
import { Forum, Jost } from 'next/font/google';
import { PORTFOLIO_ORIGIN } from '@/lib/site-routing';
import SiteHeader from './_components/SiteHeader';
import SiteFooter from './_components/SiteFooter';
import './site.css';

// Forum is the display face from Rosie's original site; Jost stands in for its Avenir.
const forum = Forum({ weight: '400', subsets: ['latin'], variable: '--font-forum', display: 'swap' });
const jost = Jost({ subsets: ['latin'], variable: '--font-jost', display: 'swap' });

const description =
  'Rosie Quintana is an actor, singer and musician on California’s Central Coast, and a voice and audition coach teaching in person and over Zoom.';

export const metadata: Metadata = {
  metadataBase: new URL(PORTFOLIO_ORIGIN),
  title: {
    default: 'Rosie Quintana | Actor | Singer | Musician',
    template: '%s | Rosie Quintana',
  },
  description,
  openGraph: {
    type: 'website',
    siteName: 'Rosie Quintana',
    title: 'Rosie Quintana | Actor | Singer | Musician',
    description,
    url: '/',
    images: [{ url: '/site/hero.jpg', width: 1067, height: 1600, alt: 'Rosie Quintana laughing' }],
  },
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`rq-site ${forum.variable} ${jost.variable} flex min-h-screen flex-col`}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-rq-accent focus:px-4 focus:py-2 focus:text-rq-on-accent"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
