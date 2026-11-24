import type { Metadata } from 'next';
import Image from 'next/image';
import { formatRate, getLessonType, getWeeklySavings } from '@/config/lessonTypes';
import ContactForm from '../_components/ContactForm';
import { ArrowLink, SectionHeading } from '../_components/SectionHeading';
import { site } from '../_content/site';

export const metadata: Metadata = {
  title: 'Voice and Audition Coaching',
  description:
    'Voice and audition coaching with Rosie Quintana, over Zoom or in person on California’s Central Coast. Your first lesson is half price.',
  alternates: { canonical: '/coaching' },
};

const shell = 'mx-auto max-w-7xl px-6 sm:px-10';
const eyebrow = 'text-[0.75rem] font-medium uppercase tracking-[0.2em] text-rq-muted';

// Prices come from the same config the booking screens charge from, so this
// page can never disagree with what a student sees when they book.
const thirty = getLessonType('voice_thirty');
const sixty = getLessonType('voice_sixty');
const monthlySavings = getWeeklySavings('voice_thirty');

function PriceRow({ label, price }: { label: string; price: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-rq-ink/15 py-3">
      <dt>{label}</dt>
      <dd className="font-display text-2xl text-rq-ink">{price}</dd>
    </div>
  );
}

function BookButton() {
  return (
    <a
      href={site.bookingHref}
      className="inline-block bg-rq-accent px-7 py-3 text-[0.8rem] font-medium uppercase tracking-[0.2em] text-rq-on-accent transition-opacity hover:opacity-85"
    >
      Book a lesson
    </a>
  );
}

export default function CoachingPage() {
  return (
    <>
      {/* Hero */}
      <section className={`${shell} grid grid-cols-1 items-center gap-x-10 gap-y-12 pb-20 pt-12 sm:pt-16 lg:grid-cols-12 lg:pb-24`}>
        <div className="lg:col-span-7">
          <h1
            className="rq-rise font-display text-[clamp(3rem,8vw,6.5rem)] leading-[0.95] text-rq-ink"
            style={{ '--rq-step': 0 } as React.CSSProperties}
          >
            Voice and Audition Coaching
          </h1>
          <p
            className="rq-rise mt-8 max-w-[34ch] text-2xl leading-snug"
            style={{ '--rq-step': 1 } as React.CSSProperties}
          >
            I’m passionate about nurturing your authentic voice!
          </p>
          <div className="rq-rise mt-10" style={{ '--rq-step': 2 } as React.CSSProperties}>
            <BookButton />
          </div>
        </div>
        <div
          className="rq-rise relative mx-auto w-full max-w-md lg:col-span-5 lg:max-w-none"
          style={{ '--rq-step': 2 } as React.CSSProperties}
        >
          <div aria-hidden="true" className="absolute -right-4 -top-4 bottom-10 left-10 bg-rq-clay/45" />
          <Image
            src="/site/coaching/smile.jpg"
            alt="Rosie Quintana smiling"
            width={1200}
            height={1026}
            priority
            sizes="(min-width: 1024px) 38vw, (min-width: 640px) 28rem, 92vw"
            className="relative h-auto w-full"
          />
        </div>
      </section>

      {/* About me */}
      <section aria-labelledby="about-me" className="border-t border-rq-ink/15">
        <div className={`${shell} grid grid-cols-1 gap-x-10 gap-y-12 py-20 lg:grid-cols-12 lg:py-28`}>
          <div className="lg:col-span-4">
            <Image
              src="/site/coaching/about.jpg"
              alt="Close portrait of Rosie Quintana"
              width={1600}
              height={1600}
              sizes="(min-width: 1024px) 30vw, 92vw"
              className="h-auto w-full max-w-sm"
            />
          </div>
          <div className="lg:col-span-7 lg:col-start-6">
            <SectionHeading id="about-me">About Me</SectionHeading>
            <div className="mt-8 max-w-[62ch] space-y-5">
              <p>
                I’m a Central Coast based performer, educator, and music director passionate about
                helping students flourish through a holistic and healthy approach to music-making. I
                hold a Bachelor’s degree in Vocal Performance with classical training, and an Acting
                Certificate from the Pacific Conservatory of Performing Arts. With over 16 years of
                experience teaching voice and piano, I offer warmth, versatility, and a deep commitment
                to each student’s unique journey and goals.
              </p>
              <p>
                I’ve performed around the world in choral, musical theatre, jazz, and pop genres, and
                have recently appeared as Esmeralda in <em>The Hunchback of Notre Dame</em> on the
                Central Coast and Margo in <em>Bright Star</em> in Long Beach. As a music director, I’ve
                had the joy of working on productions like <em>My Fair Lady</em>, and <em>Emilia</em>,
                as well as musical theater youth camps.
              </p>
              <p>
                Whether you’re just beginning your musical journey or looking to grow as an artist, I
                aim to create a nurturing space where you can develop confidence and joy in your
                authentic voice.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section aria-labelledby="pricing" className="bg-rq-paper-deep">
        <div className={`${shell} grid grid-cols-1 gap-x-10 gap-y-12 py-20 lg:grid-cols-12 lg:py-24`}>
          <div className="lg:col-span-6">
            <SectionHeading id="pricing">Voice Lesson Pricing</SectionHeading>

            {thirty && sixty && (
              <div className="mt-10 grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2">
                <div>
                  <h3 className={eyebrow}>Individual lessons</h3>
                  <p className="mt-1 text-sm text-rq-muted">Billed on day of lesson</p>
                  <dl className="mt-4 border-t border-rq-ink/15">
                    <PriceRow label="30 minutes" price={formatRate(thirty.rate)} />
                    <PriceRow label="1 hour" price={formatRate(sixty.rate)} />
                  </dl>
                </div>
                <div>
                  <h3 className={eyebrow}>Monthly plans</h3>
                  <p className="mt-1 text-sm text-rq-muted">Weekly lessons, billed monthly</p>
                  <dl className="mt-4 border-t border-rq-ink/15">
                    <PriceRow label="30 minutes" price={`${formatRate(thirty.weeklyMonthlyRate)}/month`} />
                    <PriceRow label="1 hour" price={`${formatRate(sixty.weeklyMonthlyRate)}/month`} />
                  </dl>
                </div>
              </div>
            )}

            <p className="mt-8 max-w-[52ch]">
              Monthly Plans offer best value with approximately {formatRate(monthlySavings)} off a month!
            </p>
            <p className="mt-6 max-w-[40ch] font-display text-3xl leading-tight text-rq-accent">
              Your first lesson is half price!
            </p>
            <p className="mt-3 max-w-[52ch]">
              We will focus on setting goals and evaluating points of strength and growth.
            </p>
            <div className="mt-8">
              <BookButton />
            </div>
          </div>

          <div className="lg:col-span-5 lg:col-start-8">
            <Image
              src="/site/coaching/concert.jpg"
              alt="Rosie singing as a soloist in a red gown, in front of a choir and orchestra"
              width={1074}
              height={756}
              sizes="(min-width: 1024px) 38vw, 92vw"
              className="h-auto w-full"
            />
          </div>
        </div>
      </section>

      {/* Zoom, policies */}
      <section aria-labelledby="policies" className={`${shell} grid grid-cols-1 gap-x-10 gap-y-12 py-20 lg:grid-cols-12 lg:py-28`}>
        <div className="lg:col-span-5">
          <Image
            src="/site/coaching/camp.jpg"
            alt="Rosie at a keyboard leading a room of young singers holding sheet music"
            width={1600}
            height={868}
            sizes="(min-width: 1024px) 38vw, 92vw"
            className="h-auto w-full"
          />
        </div>
        <div className="lg:col-span-6 lg:col-start-7">
          <SectionHeading id="policies">Zoom, Policies, etc.</SectionHeading>
          <div className="mt-8 max-w-[62ch] space-y-5">
            <p>
              Lessons may be conducted over Zoom or in person in the Central Coast area. If you live
              further than 20 minutes from Santa Maria/Orcutt, I may charge a travel fee of $10 to $15.
            </p>
            <p>
              For virtual lessons, all you need is a phone, tablet, or computer and a place to set up
              where you are comfortable standing, moving, and making big sounds. I can guide you to
              configure optimal sound settings on your device.
            </p>
            <div>
              <p>Extra helpful (but optional) items to have for Zoom lessons:</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 marker:text-rq-accent">
                <li>earbuds or cordless headphones</li>
                <li>
                  bluetooth speaker for your background music to play from a separate device than your
                  Zoom.
                </li>
              </ul>
            </div>
            <p>Policies concerning payments and cancellations can be found below.</p>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
            <ArrowLink href={site.files.monthlyAgreement} download>
              Monthly Lesson Agreement
            </ArrowLink>
            <ArrowLink href={site.files.individualAgreement} download>
              Individual Lesson Agreement
            </ArrowLink>
          </div>
        </div>
      </section>

      {/* Book a lesson */}
      <section aria-labelledby="book" className="border-t border-rq-ink/15">
        <div className={`${shell} grid grid-cols-1 gap-x-10 gap-y-12 py-20 lg:grid-cols-12 lg:py-28`}>
          <div className="lg:col-span-5">
            <SectionHeading id="book">Book a Lesson!</SectionHeading>
            <p className="mt-8 max-w-[40ch]">
              Tell me a little bit about who you are and how I can be part of your musical story.
            </p>
            <dl className="mt-8 space-y-4">
              <div>
                <dt className={eyebrow}>Email</dt>
                <dd>
                  <a href={`mailto:${site.email}?subject=Voice%20Lesson%20Interest`} className="rq-link">
                    {site.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className={eyebrow}>Phone</dt>
                <dd>
                  <a href={site.phone.href} className="rq-link">
                    {site.phone.display}
                  </a>
                </dd>
              </div>
            </dl>
            <p className="mt-8 text-sm text-rq-muted">
              Ready to pick a time?{' '}
              <a href={site.bookingHref} className="rq-link">
                Book online
              </a>
              .
            </p>
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <ContactForm topic="lessons" submitLabel="Send" sentMessage="I look forward to connecting with you soon!" />
          </div>
        </div>
      </section>
    </>
  );
}
