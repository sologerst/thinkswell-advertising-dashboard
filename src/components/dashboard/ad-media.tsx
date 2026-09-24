"use client";

import clsx from "clsx";
import { ChevronLeft, ChevronRight, ExternalLink, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { AdMedia } from "@/lib/creative";

/**
 * The ad's creative: the real image, a playable video, or a swipeable carousel.
 * Meta CDN links expire, so each image falls back to the next candidate and
 * finally to a branded placeholder. `children` are overlay badges.
 */
export function AdMediaView({
  media,
  title,
  placeholderClass,
  dimmed,
  children,
}: {
  media: AdMedia;
  title: string;
  placeholderClass: string;
  dimmed?: boolean;
  children?: ReactNode;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const [card, setCard] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  const cards = media.cards.filter((c) => !failed.includes(c));
  const current = cards.length ? cards[card % cards.length]! : null;
  const src = current ?? media.stills.find((s) => !failed.includes(s)) ?? null;
  const canPlay = media.kind === "video" && Boolean(media.video) && !videoFailed;
  const externalUrl = media.previewUrl ?? media.postUrl;

  const fail = useCallback((url: string) => setFailed((f) => (f.includes(url) ? f : [...f, url])), []);
  const step = (d: number) => setCard((c) => (c + d + cards.length) % cards.length);

  return (
    <div className={clsx("relative aspect-square overflow-hidden bg-gradient-to-br", placeholderClass)}>
      {playing && media.video ? (
        <video
          src={media.video}
          poster={src ?? undefined}
          controls
          autoPlay
          playsInline
          className="absolute inset-0 size-full bg-black object-contain"
          onError={() => {
            setVideoFailed(true);
            setPlaying(false);
          }}
        />
      ) : src ? (
        <>
          {/* Blurred copy fills the frame so any aspect ratio (1:1, 4:5, 9:16) shows uncropped. */}
          <Still src={src} onFail={fail} className="absolute inset-0 size-full scale-110 object-cover opacity-50 blur-2xl" decorative />
          <Still
            src={src}
            onFail={fail}
            alt={title}
            className={clsx(
              "absolute inset-0 size-full object-contain transition duration-500 group-hover:scale-[1.02]",
              dimmed && "grayscale-[45%] group-hover:grayscale-0",
            )}
          />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgb(255_255_255/0.25),transparent_45%)]" />
          <div className="absolute inset-x-4 bottom-12">
            <div className="line-clamp-3 font-serif text-[1.45rem] leading-tight text-white drop-shadow">{title}</div>
          </div>
        </>
      )}

      {!playing && (
        <>
          {media.kind === "video" && (canPlay || media.previewUrl) && (
            <div className="absolute inset-0 grid place-items-center">
              {canPlay ? (
                <button type="button" onClick={() => setPlaying(true)} aria-label={`Play ${title}`} className="play-btn">
                  <Play className="size-6 translate-x-0.5 fill-current" />
                </button>
              ) : (
                <a href={media.previewUrl!} target="_blank" rel="noopener noreferrer" aria-label={`Watch ${title} on Meta`} className="play-btn">
                  <Play className="size-6 translate-x-0.5 fill-current" />
                </a>
              )}
            </div>
          )}

          {cards.length > 1 && (
            <>
              <button type="button" onClick={() => step(-1)} aria-label="Previous card" className="carousel-btn left-2">
                <ChevronLeft className="size-4" />
              </button>
              <button type="button" onClick={() => step(1)} aria-label="Next card" className="carousel-btn right-2">
                <ChevronRight className="size-4" />
              </button>
              <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
                {cards.slice(0, 10).map((c, i) => (
                  <span key={c} className={clsx("size-1.5 rounded-full transition", i === card % cards.length ? "bg-white" : "bg-white/40")} />
                ))}
              </div>
            </>
          )}

          {externalUrl && (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute right-3 bottom-3 inline-flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[0.65rem] font-bold text-white backdrop-blur transition hover:bg-black/70"
            >
              {media.previewUrl ? "Preview" : "View post"} <ExternalLink className="size-3" />
            </a>
          )}

          <div className="pointer-events-none absolute inset-0">{children}</div>
        </>
      )}
    </div>
  );
}

function Still({ src, onFail, className, alt = "", decorative }: { src: string; onFail: (src: string) => void; className: string; alt?: string; decorative?: boolean }) {
  const ref = useRef<HTMLImageElement>(null);
  // An image that failed before hydration never fires onError in React, so check once mounted.
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth === 0) onFail(src);
  }, [src, onFail]);
  return (
    // Meta CDN URLs are signed and short-lived, so skip next/image optimisation.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt={alt}
      aria-hidden={decorative || undefined}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => onFail(src)}
      className={className}
    />
  );
}
