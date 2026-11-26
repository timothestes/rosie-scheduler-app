'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { PerformanceVideo } from '../_content/videos';

/**
 * One large player beside a numbered list of every clip. Choosing a clip from
 * the list plays it in the large player. YouTube's player is only loaded once
 * someone presses play. Sits on the dark "house" band.
 */
export default function ClipPlayer({ videos }: { videos: PerformanceVideo[] }) {
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const video = videos[current];

  if (!video) return null;

  return (
    <div className="grid grid-cols-1 gap-x-12 gap-y-8 lg:grid-cols-12">
      <figure className="lg:col-span-7">
        <div className="relative aspect-video overflow-hidden bg-black">
          {playing ? (
            <iframe
              key={video.youtubeId}
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
                priority={current === 0}
                sizes="(min-width: 1024px) 55vw, 92vw"
                className="object-cover"
              />
              <span className="absolute bottom-5 left-5 flex h-[3.75rem] w-[3.75rem] items-center justify-center bg-[#B3121F] text-white transition-colors duration-150 group-hover:bg-white group-hover:text-[#101116]">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 fill-current">
                  <path d="M8 5.5v13l11-6.5z" />
                </svg>
              </span>
            </button>
          )}
        </div>
        <figcaption className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="rq-role text-[1.375rem] text-rq-house-ink">{video.title}</span>
          <span className="text-sm text-rq-house-muted">{video.writers}</span>
        </figcaption>
      </figure>

      <ol className="border-b border-rq-house-rule lg:col-span-5">
        {videos.map((item, i) => {
          const selected = i === current;
          return (
            <li key={item.youtubeId} className="border-t border-rq-house-rule">
              <button
                type="button"
                onClick={() => {
                  setCurrent(i);
                  setPlaying(true);
                }}
                aria-current={selected ? 'true' : undefined}
                aria-label={`Play video ${i + 1}: ${item.title}`}
                className="group flex min-h-[2.875rem] w-full items-baseline gap-4 py-2.5 text-left"
              >
                <span className="w-4 shrink-0 text-sm tabular-nums text-rq-house-muted">{i + 1}</span>
                <span
                  className={`min-w-0 flex-1 underline-offset-4 group-hover:underline ${
                    selected ? 'font-semibold text-rq-house-ink' : 'text-rq-house-ink'
                  }`}
                >
                  {item.title}
                </span>
                <span className="hidden max-w-[45%] text-right text-sm text-rq-house-muted sm:block">
                  {item.writers}
                </span>
                <span aria-hidden="true" className={`w-3 shrink-0 text-xs ${selected ? 'text-rq-house-ink' : 'text-transparent'}`}>
                  ▶
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
