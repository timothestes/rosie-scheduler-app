import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import ContactForm from './_components/ContactForm';
import PhotoGallery from './_components/PhotoGallery';
import { ArrowLink, SectionHeading } from './_components/SectionHeading';
import VideoGrid from './_components/VideoGrid';
import { featuredPhotos, headshots } from './_content/photos';
import { site } from './_content/site';
import { featuredVideos } from './_content/videos';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

const shell = 'mx-auto max-w-7xl px-6 sm:px-10';

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className={`${shell} pb-20 pt-12 sm:pt-16 lg:pb-28`}>
        <div className="grid grid-cols-1 items-end gap-x-10 gap-y-12 lg:grid-cols-12">
          <div className="lg:col-span-8 lg:pb-10">
            <p
              className="rq-rise text-[0.8rem] font-medium uppercase tracking-[0.3em] text-rq-accent"
              style={{ '--rq-step': 0 } as React.CSSProperties}
            >
              {site.roles.join(' / ')}
            </p>
            <h1
              className="rq-rise mt-5 font-display text-[clamp(3.5rem,10.5vw,8.5rem)] uppercase leading-[0.9] text-rq-ink"
              style={{ '--rq-step': 1 } as React.CSSProperties}
            >
              Rosie
              <br />
              Quintana
            </h1>
            <div
              className="rq-rise mt-10 flex flex-wrap gap-x-10 gap-y-4"
              style={{ '--rq-step': 2 } as React.CSSProperties}
            >
              <ArrowLink href="/media">Songs and production photos</ArrowLink>
              <ArrowLink href="/coaching">Voice and audition coaching</ArrowLink>
            </div>
          </div>

          <div
            className="rq-rise relative mx-auto w-full max-w-sm lg:col-span-4 lg:max-w-none"
            style={{ '--rq-step': 2 } as React.CSSProperties}
          >
            <div aria-hidden="true" className="absolute -bottom-4 -left-4 right-8 top-10 bg-rq-clay/45" />
            <Image
              src="/site/hero.jpg"
              alt="Rosie Quintana laughing, in a red velvet top"
              width={1067}
              height={1600}
              priority
              sizes="(min-width: 1024px) 30vw, (min-width: 640px) 24rem, 92vw"
              className="relative h-auto w-full"
            />
          </div>
        </div>
      </section>

      {/* About */}
      <section aria-labelledby="about" className="scroll-mt-8 border-t border-rq-ink/15">
        <div className={`${shell} grid grid-cols-1 gap-x-10 gap-y-12 py-20 lg:grid-cols-12 lg:py-28`}>
          <div className="lg:col-span-4">
            <Image
              src="/site/home-band.jpg"
              alt="Rosie playing an upright piano, in black and white"
              width={598}
              height={900}
              sizes="(min-width: 1024px) 30vw, 92vw"
              className="h-auto w-full max-w-sm"
            />
          </div>

          <div className="lg:col-span-7 lg:col-start-6">
            <SectionHeading id="about">About</SectionHeading>
            <div className="mt-8 max-w-[62ch] space-y-5">
              <p className="text-xl leading-relaxed">
                Rosie is an actor, singer, and musician with a passion for performing collaborative
                storytelling in theatre and other mediums.
              </p>
              <p>
                This rekindled dream to tell meaningful stories on stage pulled her back to her native
                California from a stint in Chicago where she earned her BMus in vocal performance. Her
                deepest passion is in telling stories that uplift and give hope to others, and she is
                deeply grateful for each new opportunity.
              </p>
              <p>
                I am now offering vocal coaching lessons virtually and at your own home (if you are in
                the Santa Maria area)! Check out more information{' '}
                <Link href="/coaching" className="rq-link">
                  here
                </Link>
                .
              </p>
            </div>

            <div className="mt-10 max-w-[62ch] border-t border-rq-ink/20 pt-6">
              <p className="text-[0.75rem] font-medium uppercase tracking-[0.2em] text-rq-muted">Currently</p>
              <p className="mt-2">
                I recently relocated to the Central Coast. You can find me running afterschool theatre
                classes for kids through SLOREP’s ACT program, and teaching private voice lessons.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Resume */}
      <section aria-labelledby="resume" className="bg-rq-paper-deep">
        <div className={`${shell} grid grid-cols-1 gap-x-10 gap-y-10 py-20 lg:grid-cols-12 lg:py-24`}>
          <div className="lg:col-span-4">
            <SectionHeading id="resume">Resume</SectionHeading>
            <div className="mt-8">
              <ArrowLink href={site.files.resume} download>
                Download resume (PDF)
              </ArrowLink>
            </div>
          </div>
          <a
            href={site.files.resume}
            className="block border border-rq-ink/20 bg-white lg:col-span-7 lg:col-start-6"
            aria-label="Open Rosie Quintana’s resume as a PDF"
          >
            <Image
              src="/site/resume.jpg"
              alt="Rosie Quintana’s performance resume"
              width={1131}
              height={1600}
              sizes="(min-width: 1024px) 55vw, 92vw"
              className="h-auto w-full"
            />
          </a>
        </div>
      </section>

      {/* Production photos */}
      <section aria-labelledby="production-photos" className={`${shell} py-20 lg:py-28`}>
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
          <SectionHeading id="production-photos">Production Photos</SectionHeading>
          <ArrowLink href="/media#production-photos">All production photos</ArrowLink>
        </div>
        <div className="mt-12">
          <PhotoGallery photos={featuredPhotos(6)} />
        </div>
      </section>

      {/* Songs */}
      <section aria-labelledby="songs" className="border-t border-rq-ink/15">
        <div className={`${shell} py-20 lg:py-28`}>
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
            <SectionHeading id="songs">Songs</SectionHeading>
            <ArrowLink href="/media#songs">All songs</ArrowLink>
          </div>
          <div className="mt-12">
            <VideoGrid videos={featuredVideos(3)} />
          </div>
        </div>
      </section>

      {/* Headshots */}
      <section aria-labelledby="headshots" className="bg-rq-paper-deep">
        <div className={`${shell} py-20 lg:py-24`}>
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
            <SectionHeading id="headshots">Headshots</SectionHeading>
            <ArrowLink href={site.files.headshots} download>
              Download headshot
            </ArrowLink>
          </div>
          <ul className="mt-12 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {headshots.map((shot, i) => (
              <li key={shot.src} className={i % 2 === 1 ? 'lg:mt-10' : undefined}>
                <Image
                  src={shot.src}
                  alt={`Rosie Quintana headshot ${i + 1} of ${headshots.length}`}
                  width={shot.width}
                  height={shot.height}
                  sizes="(min-width: 1024px) 22vw, 45vw"
                  className="h-auto w-full"
                />
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-rq-muted">Photos by Jesse Saler</p>
        </div>
      </section>

      {/* Contact */}
      <section aria-labelledby="contact" className={`${shell} grid grid-cols-1 gap-x-10 gap-y-12 py-20 lg:grid-cols-12 lg:py-28`}>
        <div className="lg:col-span-5">
          <SectionHeading id="contact">Contact Me</SectionHeading>
          <p className="mt-8 max-w-[40ch]">
            Get in touch by filling out the form. You are also welcome to reach out to me by email at{' '}
            <a href={`mailto:${site.email}`} className="rq-link">
              {site.email}
            </a>
            .
          </p>
        </div>
        <div className="lg:col-span-6 lg:col-start-7">
          <ContactForm sentMessage="I look forward to creating with you!" />
        </div>
      </section>
    </>
  );
}
