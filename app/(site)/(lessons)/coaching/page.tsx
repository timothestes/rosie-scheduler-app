import type { Metadata } from 'next';
import Image from 'next/image';
import { formatRate, getLessonType, getWeeklySavings } from '@/config/lessonTypes';
import ContactForm from '../../_components/ContactForm';
import { ArrowLink, SectionHeading } from '../../_components/SectionHeading';
import { site } from '../../_content/site';

const description =
  'Voice and audition coaching with Rosie Quintana, over Zoom or in person on California’s Central Coast. Your first lesson is half price.';

export const metadata: Metadata = {
  title: { absolute: 'Voice and Audition Coaching | Rosie Quintana' },
  description,
  alternates: { canonical: '/coaching' },
  openGraph: { title: 'Voice and Audition Coaching | Rosie Quintana', description, url: '/coaching' },
};

const shell = 'mx-auto max-w-[90rem] px-5 sm:px-16';

// Prices come from the same config the booking screens charge from, so this
// page can never disagree with what a student sees when they book.
const thirty = getLessonType('voice_thirty');
const sixty = getLessonType('voice_sixty');
const monthlySavings = getWeeklySavings('voice_thirty');

function PriceRow({ label, price }: { label: string; price: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-rq-rule py-3">
      <dt>{label}</dt>
      <dd className="rq-role text-2xl tabular-nums text-rq-ink">{price}</dd>
    </div>
  );
}

function BookButton() {
  return (
    <a href={site.bookingHref} className="rq-button rq-button-solid">
      Book a lesson
    </a>
  );
}

export default function CoachingPage() {
  return (
    <>
      {/* First screen */}
      <section className="mx-auto grid max-w-[90rem] grid-cols-1 lg:grid-cols-12">
        <div className="flex flex-col items-start gap-6 px-5 py-10 sm:px-16 lg:col-span-7 lg:py-16">
          <h1 className="rq-display text-[clamp(3.25rem,6.6vw,6rem)] !leading-[0.9] text-rq-ink">
            Voice and Audition Coaching
          </h1>
          <p className="max-w-[30ch] text-[1.4375rem] font-medium leading-[1.35]">
            I’m passionate about nurturing your authentic voice!
          </p>
          <p className="text-[1.0625rem]">
            <span className="bg-rq-accent px-2 py-1 font-semibold text-rq-on-accent">
              Your first lesson is half price
            </span>
          </p>
          <BookButton />
        </div>
        <div className="relative aspect-[6/5] bg-[#e9e9e6] lg:col-span-5 lg:aspect-auto lg:min-h-[32rem]">
          <Image
            src="/site/coaching/smile.jpg"
            alt="Rosie Quintana smiling"
            fill
            priority
            sizes="(min-width: 1024px) 42vw, 100vw"
            className="object-cover object-[50%_25%]"
          />
        </div>
      </section>

      {/* Pricing */}
      <section aria-labelledby="pricing" className="border-t border-rq-rule">
        <div className={`${shell} grid grid-cols-1 gap-x-14 gap-y-10 py-16 lg:grid-cols-12 lg:py-[4.5rem]`}>
          <div className="lg:col-span-7">
            <SectionHeading id="pricing">Voice lesson pricing</SectionHeading>

            {thirty && sixty && (
              <div className="mt-8 grid grid-cols-1 gap-x-12 gap-y-8 sm:grid-cols-2">
                <div>
                  <h3 className="rq-label">Individual lessons</h3>
                  <p className="mt-1 text-sm text-rq-muted">Billed on day of lesson</p>
                  <dl className="mt-3 border-t-2 border-rq-ink">
                    <PriceRow label="30 minutes" price={formatRate(thirty.rate)} />
                    <PriceRow label="1 hour" price={formatRate(sixty.rate)} />
                  </dl>
                </div>
                <div>
                  <h3 className="rq-label">Monthly plans</h3>
                  <p className="mt-1 text-sm text-rq-muted">Weekly lessons, billed monthly</p>
                  <dl className="mt-3 border-t-2 border-rq-ink">
                    <PriceRow label="30 minutes" price={`${formatRate(thirty.weeklyMonthlyRate)}/month`} />
                    <PriceRow label="1 hour" price={`${formatRate(sixty.weeklyMonthlyRate)}/month`} />
                  </dl>
                </div>
              </div>
            )}

            <p className="mt-6 max-w-[52ch]">
              Monthly Plans offer best value with approximately {formatRate(monthlySavings)} off a month!
            </p>
            <p className="mt-3 max-w-[52ch]">
              Your first lesson is half price! We will focus on setting goals and evaluating points of
              strength and growth.
            </p>
            <div className="mt-6">
              <BookButton />
            </div>
          </div>

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
        </div>
      </section>

      {/* About me */}
      <section aria-labelledby="about-me" className="border-t border-rq-rule">
        <div className={`${shell} grid grid-cols-1 gap-x-14 gap-y-10 py-16 lg:grid-cols-12 lg:py-[4.5rem]`}>
          <div className="lg:col-span-3">
            <Image
              src="/site/coaching/about.jpg"
              alt="Close portrait of Rosie Quintana"
              width={1600}
              height={1600}
              sizes="(min-width: 1024px) 22vw, 20rem"
              className="h-auto w-full max-w-xs"
            />
          </div>
          <div className="flex flex-col gap-5 lg:col-span-8">
            <SectionHeading id="about-me">About me</SectionHeading>
            <div className="max-w-[68ch] space-y-4 text-[1.0625rem] leading-relaxed">
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

      {/* Zoom, policies */}
      <section aria-labelledby="policies" className="border-t border-rq-rule">
        <div className={`${shell} grid grid-cols-1 gap-x-14 gap-y-10 py-16 lg:grid-cols-12 lg:py-[4.5rem]`}>
          <div className="lg:col-span-5">
            <Image
              src="/site/coaching/concert.jpg"
              alt="Rosie singing as a soloist in a red gown, in front of a choir and orchestra"
              width={1074}
              height={756}
              sizes="(min-width: 1024px) 38vw, 92vw"
              className="h-auto w-full"
            />
          </div>
          <div className="flex flex-col gap-5 lg:col-span-7">
            <SectionHeading id="policies">Zoom, policies, etc.</SectionHeading>
            <div className="max-w-[62ch] space-y-4">
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
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>earbuds or cordless headphones</li>
                  <li>
                    bluetooth speaker for your background music to play from a separate device than your
                    Zoom.
                  </li>
                </ul>
              </div>
              <p>Policies concerning payments and cancellations can be found below.</p>
            </div>
            <div className="flex flex-wrap gap-x-10 gap-y-3">
              <ArrowLink href={site.files.monthlyAgreement} download>
                Monthly Lesson Agreement
              </ArrowLink>
              <ArrowLink href={site.files.individualAgreement} download>
                Individual Lesson Agreement
              </ArrowLink>
            </div>
          </div>
        </div>
      </section>

      {/* Book a lesson */}
      <section aria-labelledby="book" className="border-t border-rq-rule">
        <div className={`${shell} grid grid-cols-1 gap-x-14 gap-y-8 py-16 lg:grid-cols-12 lg:py-[4.5rem]`}>
          <div className="flex flex-col gap-5 lg:col-span-4">
            <SectionHeading id="book">Book a lesson!</SectionHeading>
            <p className="max-w-[40ch]">
              Tell me a little bit about who you are and how I can be part of your musical story.
            </p>
            <dl className="space-y-3">
              <div>
                <dt className="rq-label">Email</dt>
                <dd>
                  <a href={`mailto:${site.email}?subject=Voice%20Lesson%20Interest`} className="rq-link">
                    {site.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="rq-label">Phone</dt>
                <dd>
                  <a href={site.phone.href} className="rq-link">
                    {site.phone.display}
                  </a>
                </dd>
              </div>
            </dl>
            <p className="text-sm text-rq-muted">
              Ready to pick a time?{' '}
              <a href={site.bookingHref} className="rq-link">
                Book online
              </a>
              .
            </p>
          </div>
          <div className="lg:col-span-7 lg:col-start-6">
            <ContactForm topic="lessons" submitLabel="Send" sentMessage="I look forward to connecting with you soon!" />
          </div>
        </div>
      </section>
    </>
  );
}
