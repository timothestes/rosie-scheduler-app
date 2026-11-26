import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { PORTFOLIO_ORIGIN } from '@/lib/site-routing';
import './site.css';

// Both faces are self-hosted from ./fonts (see the README there) so the build
// never has to fetch from Google. Archivo's width axis gives the condensed
// capitals; Plex Sans is the reading face.
const archivo = localFont({
  src: './fonts/archivo-latin-variable.woff2',
  weight: '100 900',
  declarations: [{ prop: 'font-stretch', value: '62% 125%' }],
  variable: '--font-archivo',
  display: 'swap',
  fallback: ['Arial Narrow', 'sans-serif'],
});
const plex = localFont({
  src: './fonts/ibm-plex-sans-latin-variable.woff2',
  weight: '100 700',
  variable: '--font-plex',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
});

const description =
  'Rosie Quintana is an actor, singer and pianist on California’s Central Coast. Headshots, resume, performance clips and production photos.';

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

// Shared shell for the public pages. The acting pages and the lessons page each
// add their own header and footer in the (acting) and (lessons) layouts.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`rq-site ${archivo.variable} ${plex.variable} flex min-h-screen flex-col`}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-rq-accent focus:px-4 focus:py-2 focus:text-rq-on-accent"
      >
        Skip to content
      </a>
      {children}
    </div>
  );
}
