import type { Metadata } from 'next';
import Image from 'next/image';
import ClipPlayer from '../_components/ClipPlayer';
import ContactForm from '../_components/ContactForm';
import PhotoGallery from '../_components/PhotoGallery';
import { ArrowLink, SectionHeading } from '../_components/SectionHeading';
import { recentCredits } from '../_content/credits';
import { featuredPhotos, headshots } from '../_content/photos';
import { site } from '../_content/site';
import { performanceVideos } from '../_content/videos';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

const shell = 'mx-auto max-w-[90rem] px-5 sm:px-16';
const creditColumns = 'sm:grid sm:grid-cols-[1.15fr_1.6fr_1fr] sm:items-baseline sm:gap-4';

export default function HomePage() {
  return (
    <>
      {/* First screen: her face, her credits, three ways to see more. */}
      <section className="mx-auto grid max-w-[90rem] grid-cols-1 lg:grid-cols-12">
        <div className="relative aspect-[4/5] bg-[#3a3b40] lg:col-span-5 lg:aspect-auto lg:min-h-[51rem]">
          <Image
            src="/site/hero.jpg"
            alt="Rosie Quintana laughing, in a red velvet top"
            fill
            priority
            sizes="(min-width: 1024px) 42vw, 100vw"
            className="object-cover object-[50%_20%]"
          />
        </div>

        <div className="flex flex-col gap-7 px-5 py-10 sm:px-16 lg:col-span-7 lg:py-12">
          <div className="flex flex-col gap-3.5">
            <h1 className="rq-display text-[clamp(4rem,8.4vw,7.75rem)] !leading-[0.88] text-rq-ink">
              Rosie
              <br />
              Quintana
            </h1>
            <p className="text-[1.1875rem] font-medium">
              {site.roles.join(' / ')} <span className="font-normal text-rq-muted">· {site.location}</span>
            </p>
            <p className="text-[0.9375rem] text-rq-muted">{site.vitals.join(' / ')}</p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <a href="#headshots" className="rq-button">
              Headshots
            </a>
            <a href={site.files.resume} className="rq-button">
              Resume PDF
            </a>
            <a href="#clips" className="rq-button rq-button-solid">
              Watch a clip
            </a>
          </div>

          <div>
            <div aria-hidden="true" className={`rq-label hidden border-b-2 border-rq-ink pb-2 ${creditColumns}`}>
              <span>Role</span>
              <span>Production</span>
              <span>Company</span>
            </div>
            <ul aria-label="Recent roles" className="border-t-2 border-rq-ink sm:border-t-0">
              {recentCredits.map((credit) => (
                <li
                  key={`${credit.role}-${credit.production}`}
                  className={`border-b border-rq-rule py-2.5 ${creditColumns}`}
                >
                  <span className="rq-role block text-[1.4375rem] text-rq-ink">{credit.role}</span>
                  <span className="block">{credit.production}</span>
                  <span className="block text-[0.9375rem] text-rq-muted">{credit.company}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* About */}
      <section aria-labelledby="about" className="scroll-mt-6 border-t border-rq-rule">
        <div className={`${shell} grid grid-cols-1 gap-x-14 gap-y-10 py-16 lg:grid-cols-12 lg:py-[4.5rem]`}>
          <div className="lg:col-span-3">
            <Image
              src="/site/home-band.jpg"
              alt="Rosie playing an upright piano, in black and white"
              width={598}
              height={900}
              sizes="(min-width: 1024px) 22vw, 20rem"
              className="h-auto w-full max-w-xs"
            />
          </div>

          <div className="flex flex-col gap-5 lg:col-span-5">
            <SectionHeading id="about">About</SectionHeading>
            <p className="text-[1.4375rem] font-medium leading-[1.4]">
              Rosie is an actor, singer, and musician with a passion for performing collaborative
              storytelling in theatre and other mediums.
            </p>
            <p className="text-[1.0625rem] leading-relaxed">
              This rekindled dream to tell meaningful stories on stage pulled her back to her native
              California from a stint in Chicago where she earned her BMus in vocal performance. Her
              deepest passion is in telling stories that uplift and give hope to others, and she is
              deeply grateful for each new opportunity.
            </p>
          </div>

          <div className="lg:col-span-4">
            <div className="flex flex-col gap-2 border-t-2 border-rq-ink pb-6 pt-3.5">
              <h3 className="rq-label">Currently</h3>
              <p>
                I am revelling in the joy of newlywed life and am working on Bellevue Charter School’s
                production of How to Train Your Dragon Jr! Catch these kids put on an amazing show at
                the Clark Center in Arroyo Grande on January 30th.
              </p>
            </div>
            <div className="flex flex-col gap-2 border-t border-rq-rule pt-3.5">
              <h3 className="rq-label">Lessons</h3>
              <p>
                I am now offering vocal coaching lessons virtually and at your own home (if you are in
                the Santa Maria/Orcutt area)! Check out more information here,{' '}
                <a href={site.lessonsHref} className="rq-link">
                  on my coaching site
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The work, on the dark house band */}
      <div className="rq-house bg-rq-house text-rq-house-ink">
        <div className={`${shell} flex flex-col gap-14 py-16 lg:py-[4.5rem]`}>
          <section aria-labelledby="clips" className="scroll-mt-6">
            <SectionHeading id="clips">Clips</SectionHeading>
            <div className="mt-6">
              <ClipPlayer videos={performanceVideos} />
            </div>
          </section>

          <section aria-labelledby="on-stage">
            <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-3">
              <SectionHeading id="on-stage">On stage</SectionHeading>
              <ArrowLink href="/media#production-photos" tone="house">
                All production photos
              </ArrowLink>
            </div>
            <div className="mt-6">
              <PhotoGallery photos={featuredPhotos(6)} />
            </div>
          </section>
        </div>
      </div>

      {/* Headshots */}
      <section aria-labelledby="headshots" className="scroll-mt-6">
        <div className={`${shell} py-16 lg:py-[4.5rem]`}>
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
            <SectionHeading id="headshots">Headshots</SectionHeading>
            <a href={site.files.headshots} download className="rq-button">
              Download headshot
            </a>
          </div>
          <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {headshots.map((shot, i) => (
              <li key={shot.src}>
                <Image
                  src={shot.src}
                  alt={`Rosie Quintana headshot ${i + 1} of ${headshots.length}`}
                  width={shot.width}
                  height={shot.height}
                  sizes="(min-width: 1024px) 22vw, 46vw"
                  className="h-auto w-full"
                />
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-rq-muted">Photos by Jesse Saler</p>
        </div>
      </section>

      {/* Resume */}
      <section aria-labelledby="resume" className="scroll-mt-6 border-t border-rq-rule">
        <div className={`${shell} grid grid-cols-1 gap-x-14 gap-y-8 py-16 lg:grid-cols-12 lg:py-[4.5rem]`}>
          <div className="flex flex-col items-start gap-6 lg:col-span-4">
            <SectionHeading id="resume">Resume</SectionHeading>
            <a href={site.files.resume} download className="rq-button">
              Download resume (PDF)
            </a>
          </div>
          <a
            href={site.files.resume}
            className="block border border-rq-rule bg-white lg:col-span-7 lg:col-start-6"
            aria-label="Open Rosie Quintana’s resume as a PDF"
          >
            <Image
              src="/site/resume.jpg"
              alt="Rosie Quintana’s performance resume"
              width={1131}
              height={1600}
              sizes="(min-width: 1024px) 50vw, 92vw"
              className="h-auto w-full"
            />
          </a>
        </div>
      </section>

      {/* Contact */}
      <section aria-labelledby="contact" className="scroll-mt-6 border-t border-rq-rule">
        <div className={`${shell} grid grid-cols-1 gap-x-14 gap-y-8 py-16 lg:grid-cols-12 lg:py-[4.5rem]`}>
          <div className="flex flex-col gap-5 lg:col-span-4">
            <SectionHeading id="contact">Contact me</SectionHeading>
            <p className="max-w-[40ch]">
              Get in touch by filling out the form. You are also welcome to reach out to me by email at{' '}
              <a href={`mailto:${site.email}`} className="rq-link">
                {site.email}
              </a>
              .
            </p>
          </div>
          <div className="lg:col-span-7 lg:col-start-6">
            <ContactForm sentMessage="I look forward to creating with you!" />
          </div>
        </div>
      </section>
    </>
  );
}
