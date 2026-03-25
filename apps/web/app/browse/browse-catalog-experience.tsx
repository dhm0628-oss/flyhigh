"use client";

import Hls from "hls.js";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ContentCard } from "@flyhigh/contracts";

type Rail = {
  title: string;
  items: ContentCard[];
};

type Props = {
  initialItem: ContentCard | null;
  rails: Rail[];
};

function OttRail({
  title,
  items,
  activeRailTitle,
  activeSlug,
  onPreview
}: {
  title: string;
  items: ContentCard[];
  activeRailTitle?: string;
  activeSlug?: string;
  onPreview: (item: ContentCard, railTitle: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  function animateScrollTo(targetLeft: number) {
    const track = trackRef.current;
    if (!track) return;

    const startLeft = track.scrollLeft;
    const distance = targetLeft - startLeft;
    const durationMs = 560;
    const startedAt = performance.now();

    const step = (timestamp: number) => {
      const elapsed = timestamp - startedAt;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      track.scrollLeft = startLeft + distance * eased;
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  }

  function scrollByCard(direction: "left" | "right") {
    const track = trackRef.current;
    if (!track) return;
    const amount = Math.max(220, Math.round(track.clientWidth * 0.52));
    const maxLeft = Math.max(0, track.scrollWidth - track.clientWidth);
    const targetLeft = Math.min(
      maxLeft,
      Math.max(0, track.scrollLeft + (direction === "left" ? -amount : amount))
    );
    animateScrollTo(targetLeft);
  }

  useEffect(() => {
    if (!activeSlug || activeRailTitle !== title) return;
    const track = trackRef.current;
    const activeCard = itemRefs.current[activeSlug];
    if (!track || !activeCard) return;
    activeCard.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center"
    });
  }, [activeSlug]);

  return (
    <section className="ott-rail">
      <div className="ott-rail__header">
        <h2 className="ott-rail__title">{title}</h2>
        <div className="ott-rail__actions">
          <button
            type="button"
            className="ott-rail__button ott-rail__button--text"
            aria-label={`Scroll ${title} left`}
            onClick={() => scrollByCard("left")}
          >
            Previous
          </button>
          <button
            type="button"
            className="ott-rail__button ott-rail__button--text"
            aria-label={`Scroll ${title} right`}
            onClick={() => scrollByCard("right")}
          >
            Next
          </button>
        </div>
      </div>
      <div className="ott-rail__viewport">
        <button
          type="button"
          className="ott-rail__side-button ott-rail__side-button--left"
          aria-label={`Scroll ${title} left`}
          onClick={() => scrollByCard("left")}
        >
          {"<"}
        </button>
        <div className="ott-rail__track" ref={trackRef}>
          {items.map((item) => (
            <Link
              href={`/watch/${item.slug}`}
              className={`catalog-card catalog-card--ott ott-card-button ${activeSlug === item.slug ? "is-active" : ""}`}
              key={`${title}-${item.id}`}
              ref={(node) => {
                itemRefs.current[item.slug] = node;
              }}
              onMouseEnter={() => onPreview(item, title)}
              onFocus={() => onPreview(item, title)}
            >
              <article>
                <div
                  className="catalog-card__poster catalog-card__poster--ott"
                  style={{ backgroundImage: `url(${item.posterUrl || "/home/hero-banner.jpg"})` }}
                />
                <div className="catalog-card__body catalog-card__body--ott">
                  <strong>{item.title}</strong>
                  <div className="card__meta">
                    {item.type} | {item.releaseYear ?? "n/a"} | {Math.round(item.durationSeconds / 60)} min
                  </div>
                  <div className="card__meta">{item.isPremium ? "Subscriber only" : "Free"}</div>
                </div>
              </article>
            </Link>
          ))}
        </div>
        <button
          type="button"
          className="ott-rail__side-button ott-rail__side-button--right"
          aria-label={`Scroll ${title} right`}
          onClick={() => scrollByCard("right")}
        >
          {">"}
        </button>
      </div>
    </section>
  );
}

export function BrowseCatalogExperience({ initialItem, rails }: Props) {
  const allItems = useMemo(() => {
    const seen = new Set<string>();
    const items: ContentCard[] = [];
    for (const rail of rails) {
      for (const item of rail.items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        items.push(item);
      }
    }
    return items;
  }, [rails]);

  const [selectedState, setSelectedState] = useState<{
    slug: string;
    railTitle: string;
  }>(() => {
    const fallbackSlug = initialItem?.slug ?? allItems[0]?.slug ?? "";
    const fallbackRailTitle =
      rails.find((rail) => rail.items.some((item) => item.slug === fallbackSlug))?.title ??
      rails[0]?.title ??
      "";
    return { slug: fallbackSlug, railTitle: fallbackRailTitle };
  });
  const heroVideoRef = useRef<HTMLVideoElement | null>(null);

  const activeItem =
    allItems.find((item) => item.slug === selectedState.slug) ??
    initialItem ??
    allItems[0] ??
    null;

  useEffect(() => {
    const video = heroVideoRef.current;
    if (!video) return;

    let hls: Hls | null = null;
    video.pause();
    video.removeAttribute("src");
    video.load();

    if (!activeItem?.previewUrl) {
      return;
    }

    const startPlayback = () => {
      video.currentTime = 0;
      void video.play().catch(() => {
        // Ignore autoplay rejections; the poster remains visible.
      });
    };

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = activeItem.previewUrl;
      startPlayback();
    } else if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true
      });
      hls.loadSource(activeItem.previewUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, startPlayback);
    } else {
      video.src = activeItem.previewUrl;
      startPlayback();
    }

    return () => {
      if (hls) hls.destroy();
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [activeItem?.id, activeItem?.previewUrl]);

  function handleHeroTimeUpdate() {
    const video = heroVideoRef.current;
    if (!video) return;
    if (video.currentTime >= 10) {
      video.pause();
    }
  }

  return (
    <div className="browse-catalog-experience">
      {activeItem ? (
        <>
          <div className="browse-banner browse-banner--interactive">
            <div
              className="browse-banner__media"
              style={{ backgroundImage: `url('${activeItem.posterUrl || "/home/hero-banner.jpg"}')` }}
            />
            {activeItem.previewUrl ? (
              <video
                key={activeItem.id}
                ref={heroVideoRef}
                className="browse-banner__video"
                autoPlay
                muted
                playsInline
                preload="metadata"
                poster={activeItem.posterUrl || undefined}
                onTimeUpdate={handleHeroTimeUpdate}
              />
            ) : null}
            <div className="browse-banner__overlay" />
            <div className="browse-banner__content">
              <span className="browse-banner__eyebrow">Selected title</span>
              <strong>{activeItem.title}</strong>
              <p className="card__meta">{activeItem.synopsis}</p>
              <div className="hero-banner__actions">
                <Link className="btn btn--header-primary" href={`/watch/${activeItem.slug}`}>
                  Watch Now
                </Link>
              </div>
            </div>
          </div>
          <div className="browse-mobile-feature">
            <div className="browse-mobile-feature__media">
              {activeItem.previewUrl ? (
                <video
                  key={`${activeItem.id}-mobile`}
                  className="browse-mobile-feature__video"
                  autoPlay
                  muted
                  playsInline
                  preload="metadata"
                  poster={activeItem.posterUrl || undefined}
                >
                  <source src={activeItem.previewUrl} />
                </video>
              ) : (
                <div
                  className="browse-mobile-feature__poster"
                  style={{ backgroundImage: `url('${activeItem.posterUrl || "/home/hero-banner.jpg"}')` }}
                />
              )}
            </div>
            <div className="browse-mobile-feature__body">
              <span className="browse-banner__eyebrow">Selected title</span>
              <strong>{activeItem.title}</strong>
              <p className="card__meta">{activeItem.synopsis}</p>
              <Link className="btn btn--header-primary" href={`/watch/${activeItem.slug}`}>
                Watch Now
              </Link>
            </div>
          </div>
        </>
      ) : null}

      {rails.map((rail, railIndex) => (
        <div key={`${railIndex}-${rail.title}`}>
          <OttRail
            title={rail.title}
            items={rail.items}
            activeRailTitle={selectedState.railTitle}
            activeSlug={activeItem?.slug}
            onPreview={(item, railTitle) => setSelectedState({ slug: item.slug, railTitle })}
          />
        </div>
      ))}
    </div>
  );
}
