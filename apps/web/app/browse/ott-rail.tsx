"use client";

import { useRef } from "react";
import Link from "next/link";
import type { ContentCard } from "@flyhigh/contracts";

type OttRailProps = {
  title: string;
  items: ContentCard[];
};

export function OttRail({ title, items }: OttRailProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  function scrollByCard(direction: "left" | "right") {
    const track = trackRef.current;
    if (!track) return;
    const amount = Math.max(320, Math.round(track.clientWidth * 0.9));
    track.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth"
    });
  }

  return (
    <section className="ott-rail">
      <div className="ott-rail__header">
        <h2 className="ott-rail__title">{title}</h2>
        <div className="ott-rail__actions">
          <span className="ott-rail__hint">Scroll for more</span>
          <button
            type="button"
            className="ott-rail__button"
            aria-label={`Scroll ${title} left`}
            onClick={() => scrollByCard("left")}
          >
            {"<"}
          </button>
          <button
            type="button"
            className="ott-rail__button"
            aria-label={`Scroll ${title} right`}
            onClick={() => scrollByCard("right")}
          >
            {">"}
          </button>
        </div>
      </div>
      <div className="ott-rail__track" ref={trackRef}>
        {items.map((item) => (
          <Link className="catalog-card catalog-card--ott" key={item.id} href={`/watch/${item.slug}`}>
            <article>
              {item.previewUrl ? (
                <video
                  className="catalog-card__poster catalog-card__poster--ott catalog-card__preview-video"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  poster={item.posterUrl || undefined}
                >
                  <source src={item.previewUrl} type="application/x-mpegURL" />
                </video>
              ) : (
                <div
                  className="catalog-card__poster catalog-card__poster--ott"
                  style={item.posterUrl ? { backgroundImage: `url(${item.posterUrl})` } : undefined}
                />
              )}
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
    </section>
  );
}
