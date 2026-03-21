"use client";

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
  activeSlug,
  onSelect
}: {
  title: string;
  items: ContentCard[];
  activeSlug?: string;
  onSelect: (item: ContentCard) => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function scrollByCard(direction: "left" | "right") {
    const track = trackRef.current;
    if (!track) return;
    const amount = Math.max(320, Math.round(track.clientWidth * 0.9));
    track.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth"
    });
  }

  useEffect(() => {
    if (!activeSlug) return;
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
          <span className="ott-rail__hint">Use Next to browse more titles</span>
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
            <button
              type="button"
              className={`catalog-card catalog-card--ott ott-card-button ${activeSlug === item.slug ? "is-active" : ""}`}
              key={`${title}-${item.id}`}
              ref={(node) => {
                itemRefs.current[item.slug] = node;
              }}
              onClick={() => onSelect(item)}
            >
              <article>
                <div
                  className="catalog-card__poster catalog-card__poster--ott"
                  style={item.posterUrl ? { backgroundImage: `url(${item.posterUrl})` } : undefined}
                />
                <div className="catalog-card__body catalog-card__body--ott">
                  <strong>{item.title}</strong>
                  <div className="card__meta">
                    {item.type} | {item.releaseYear ?? "n/a"} | {Math.round(item.durationSeconds / 60)} min
                  </div>
                  <div className="card__meta">{item.isPremium ? "Subscriber only" : "Free"}</div>
                </div>
              </article>
            </button>
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

  const [selectedSlug, setSelectedSlug] = useState(initialItem?.slug ?? allItems[0]?.slug ?? "");
  const heroVideoRef = useRef<HTMLVideoElement | null>(null);

  const activeItem =
    allItems.find((item) => item.slug === selectedSlug) ??
    initialItem ??
    allItems[0] ??
    null;

  useEffect(() => {
    const video = heroVideoRef.current;
    if (!video || !activeItem?.previewUrl) return;

    video.currentTime = 0;
    void video.play().catch(() => {
      // Ignore autoplay rejections; the poster remains visible.
    });
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
        <div className="browse-banner browse-banner--interactive browse-banner--sticky">
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
            >
              <source src={activeItem.previewUrl} type="application/x-mpegURL" />
            </video>
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
      ) : null}

      {rails.map((rail) => (
        <OttRail
          key={rail.title}
          title={rail.title}
          items={rail.items}
          activeSlug={activeItem?.slug}
          onSelect={(item) => setSelectedSlug(item.slug)}
        />
      ))}
    </div>
  );
}
