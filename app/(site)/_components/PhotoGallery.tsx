'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProductionPhoto } from '../_content/photos';

const COLUMNS = {
  2: 'sm:columns-2',
  3: 'sm:columns-2 lg:columns-3',
} as const;

/**
 * Production photos with their programme credits, for the dark "house" band.
 * Selecting a photo opens it large in a native <dialog>, with arrow-key and
 * button navigation.
 */
export default function PhotoGallery({
  photos,
  columns = 3,
}: {
  photos: ProductionPhoto[];
  columns?: keyof typeof COLUMNS;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState<number | null>(null);
  const current = index === null ? null : photos[index];

  const open = (i: number) => {
    setIndex(i);
    dialogRef.current?.showModal();
  };

  const step = useCallback(
    (delta: number) =>
      setIndex((i) => (i === null ? i : (i + delta + photos.length) % photos.length)),
    [photos.length]
  );

  // Keep the page behind the viewer from scrolling.
  useEffect(() => {
    if (index === null) return;
    const { overflow } = document.documentElement.style;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = overflow;
    };
  }, [index]);

  return (
    <>
      <ul className={`columns-1 gap-x-8 ${COLUMNS[columns]}`}>
        {photos.map((photo, i) => (
          <li key={photo.src} className="mb-10 break-inside-avoid">
            <figure>
              <button
                type="button"
                onClick={() => open(i)}
                aria-label={`View larger: ${photo.title}`}
                className="group block w-full overflow-hidden bg-black"
              >
                <Image
                  src={photo.src}
                  alt={photo.title}
                  width={photo.width}
                  height={photo.height}
                  sizes={
                    columns === 3
                      ? '(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw'
                      : '(min-width: 640px) 45vw, 92vw'
                  }
                  className="h-auto w-full transition-opacity duration-200 group-hover:opacity-90"
                />
              </button>
              <figcaption className="mt-3">
                <p className="rq-role text-[1.375rem] text-rq-house-ink">{photo.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-rq-house-muted">
                  {photo.credits.map((line, n) => (
                    <span key={line}>
                      {n > 0 && <span aria-hidden="true"> · </span>}
                      {line}
                    </span>
                  ))}
                </p>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        aria-label="Photo viewer"
        onClose={() => setIndex(null)}
        onClick={(event) => {
          // A click on the dark surround (the dialog itself) closes it.
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') step(1);
          if (event.key === 'ArrowLeft') step(-1);
        }}
        className="m-0 h-full max-h-none w-full max-w-none bg-[#0b0c10]/[0.97] p-0 text-[#f5f5f2] backdrop:bg-transparent"
      >
        {current && index !== null && (
          <div className="pointer-events-none flex h-full flex-col px-4 pb-5 pt-4 sm:px-8">
            <div className="pointer-events-auto flex items-center justify-between text-sm font-medium">
              <p aria-live="polite">
                {index + 1} / {photos.length}
              </p>
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="px-2 py-2 underline-offset-4 hover:underline"
              >
                Close
              </button>
            </div>

            <div className="relative min-h-0 flex-1">
              <Image
                key={current.src}
                src={current.src}
                alt={current.title}
                fill
                sizes="100vw"
                className="object-contain"
              />
            </div>

            <div className="pointer-events-auto mt-4 flex items-end justify-between gap-6">
              <button
                type="button"
                onClick={() => step(-1)}
                className="shrink-0 px-2 py-2 text-sm font-medium underline-offset-4 hover:underline"
              >
                <span aria-hidden="true">← </span>Previous
              </button>
              <div className="min-w-0 text-center">
                <p className="rq-role text-xl">{current.title}</p>
                <p className="mt-1 text-sm text-[#f5f5f2]/80">{current.credits.join(' · ')}</p>
              </div>
              <button
                type="button"
                onClick={() => step(1)}
                className="shrink-0 px-2 py-2 text-sm font-medium underline-offset-4 hover:underline"
              >
                Next<span aria-hidden="true"> →</span>
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
