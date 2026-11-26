import SiteFooter from '../_components/SiteFooter';
import SiteHeader from '../_components/SiteHeader';

// rosiequintana.com: the acting portfolio. Nothing here sells or books lessons;
// the About text carries the one link across to the lessons site.
export default function ActingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
