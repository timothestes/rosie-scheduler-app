import type { Metadata } from 'next';
import { Archivo, IBM_Plex_Sans } from 'next/font/google';
import { PORTFOLIO_ORIGIN } from '@/lib/site-routing';
import './site.css';

// Archivo's width axis gives the condensed capitals; Plex Sans is the reading face.
const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-archivo', display: 'swap' });
const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex',
  display: 'swap',
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
