'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { PerformanceVideo } from '../_content/videos';

const COLUMNS = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
} as const;

/** Poster first; YouTube's player is only loaded once someone presses play. */
function VideoCard({ video, sizes }: { video: PerformanceVideo; sizes: string }) {
  const [playing, setPlaying] = useState(false);

  return (
    <figure>
      <div className="relative aspect-video overflow-hidden bg-[#1d1115]">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&rel=0`}
            title={`${video.title}, performed by Rosie Quintana`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Play video: ${video.title}`}
            className="group absolute inset-0 h-full w-full"
          >
            <Image
              src={video.poster}
              alt=""
              fill
              sizes={sizes}
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
            />
            <span className="absolute inset-0 bg-[#1d1115]/25 transition-colors duration-300 group-hover:bg-[#1d1115]/10" />
            <span className="absolute bottom-4 left-4 flex h-14 w-14 items-center justify-center rounded-full border border-[#fff0ec] bg-[#1d1115]/55 text-[#fff0ec] transition-colors duration-300 group-hover:bg-[#870019]">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="ml-0.5 h-5 w-5 fill-current">
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
            </span>
          </button>
        )}
      </div>
      <figcaption className="mt-3">
        <p className="font-display text-xl leading-snug text-rq-ink">{video.title}</p>
        <p className="mt-1 text-sm text-rq-muted">{video.writers}</p>
      </figcaption>
    </figure>
  );
}

export default function VideoGrid({
  videos,
  columns = 3,
}: {
  videos: PerformanceVideo[];
  columns?: keyof typeof COLUMNS;
}) {
  const sizes =
    columns === 3 ? '(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw' : '(min-width: 640px) 45vw, 92vw';

  return (
    <ul className={`grid grid-cols-1 gap-x-8 gap-y-10 ${COLUMNS[columns]}`}>
      {videos.map((video) => (
        <li key={video.youtubeId}>
          <VideoCard video={video} sizes={sizes} />
        </li>
      ))}
    </ul>
  );
}
