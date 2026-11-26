import type { Metadata } from 'next';
import ClipPlayer from '../../_components/ClipPlayer';
import PhotoGallery from '../../_components/PhotoGallery';
import { SectionHeading } from '../../_components/SectionHeading';
import { productionPhotos } from '../../_content/photos';
import { performanceVideos } from '../../_content/videos';

export const metadata: Metadata = {
  title: 'Media',
  description: 'Performance clips and production photos from Rosie Quintana’s work on stage.',
  alternates: { canonical: '/media' },
};

const shell = 'mx-auto max-w-[90rem] px-5 sm:px-16';

export default function MediaPage() {
  return (
    <>
      <div className={`${shell} pb-8 pt-10 sm:pt-12`}>
        <h1 className="rq-display text-[clamp(4rem,8.4vw,7.75rem)] !leading-[0.88] text-rq-ink">Media</h1>
      </div>

      <div className="rq-house bg-rq-house text-rq-house-ink">
        <div className={`${shell} flex flex-col gap-16 py-16 lg:py-[4.5rem]`}>
          <section aria-labelledby="clips" className="scroll-mt-6">
            <SectionHeading id="clips">Clips</SectionHeading>
            <div className="mt-6">
              <ClipPlayer videos={performanceVideos} />
            </div>
          </section>

          <section aria-labelledby="production-photos" className="scroll-mt-6">
            <SectionHeading id="production-photos">Production photos</SectionHeading>
            <div className="mt-6">
              <PhotoGallery photos={productionPhotos} />
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
