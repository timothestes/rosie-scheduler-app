import type { Metadata } from 'next';
import PhotoGallery from '../_components/PhotoGallery';
import { SectionHeading } from '../_components/SectionHeading';
import VideoGrid from '../_components/VideoGrid';
import { productionPhotos } from '../_content/photos';
import { performanceVideos } from '../_content/videos';

export const metadata: Metadata = {
  title: 'Media',
  description: 'Songs and production photos from Rosie Quintana’s work on stage.',
  alternates: { canonical: '/media' },
};

const shell = 'mx-auto max-w-7xl px-6 sm:px-10';

export default function MediaPage() {
  return (
    <>
      <section className={`${shell} pb-14 pt-12 sm:pt-16`}>
        <h1
          className="rq-rise font-display text-[clamp(3.5rem,10.5vw,8.5rem)] uppercase leading-[0.9] text-rq-ink"
          style={{ '--rq-step': 0 } as React.CSSProperties}
        >
          Media
        </h1>
      </section>

      <section aria-labelledby="songs" className="scroll-mt-8 border-t border-rq-ink/15">
        <div className={`${shell} py-16 lg:py-24`}>
          <SectionHeading id="songs">Songs</SectionHeading>
          <div className="mt-12">
            <VideoGrid videos={performanceVideos} />
          </div>
        </div>
      </section>

      <section aria-labelledby="production-photos" className="scroll-mt-8 border-t border-rq-ink/15">
        <div className={`${shell} py-16 lg:py-24`}>
          <SectionHeading id="production-photos">Production Photos</SectionHeading>
          <div className="mt-12">
            <PhotoGallery photos={productionPhotos} />
          </div>
        </div>
      </section>
    </>
  );
}
