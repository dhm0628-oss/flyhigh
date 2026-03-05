"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ContentCard } from "@flyhigh/contracts";
import { apiFetch } from "../lib/http";

export function HomeHeroCarousel({ items }: { items: ContentCard[] }) {
  const [index, setIndex] = useState(0);
  const sessionIdRef = useRef<string>("");
  const trackedImpressionsRef = useRef<Set<string>>(new Set());
  const total = items.length;
  const active = items[index] ?? null;

  function getSessionId() {
    if (sessionIdRef.current) return sessionIdRef.current;
    if (typeof window === "undefined") return "";

    const storageKey = "flyhigh.heroSessionId";
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      sessionIdRef.current = stored;
      return stored;
    }

    const created =
      typeof window.crypto?.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(storageKey, created);
    sessionIdRef.current = created;
    return created;
  }

  function sendHeroEvent(eventType: "IMPRESSION" | "CLICK", contentId?: string) {
    const path = typeof window !== "undefined" ? window.location.pathname : "/";
    void apiFetch("/v1/analytics/hero-events", {
      method: "POST",
      body: JSON.stringify({
        eventType,
        contentId: contentId ?? null,
        platform: "web",
        path,
        sessionId: getSessionId()
      })
    }).catch(() => undefined);
  }

  useEffect(() => {
    if (total <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % total);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [total]);

  useEffect(() => {
    if (!active?.id) return;
    if (trackedImpressionsRef.current.has(active.id)) return;
    trackedImpressionsRef.current.add(active.id);
    sendHeroEvent("IMPRESSION", active.id);
  }, [active?.id]);

  return (
    <section className="hero-banner" data-hero-theme="dark">
      <div className="hero-banner--background-image">
        <Image
          src="/home/hero-banner.jpg"
          alt={active ? `Featured: ${active.title}` : "FlyHigh TV homepage hero"}
          fill
          priority
          sizes="100vw"
          className="hero-banner__image"
        />
      </div>
      <div className="hero-banner--background-shade" />
      <div className="theme-container hero-banner-container">
        <div className="hero-banner--content">
          <h1 className="hero-banner-title">Wakeboarding On-Demand.</h1>
          <p className="hero-banner-text hero-banner-text--strong">
            Full-length classic wake films, new movies, and edits from your favorite riders. All at your fingertips.
          </p>
          <div className="hero-banner-button hero-banner__actions hero-banner__actions--single">
            <Link className="btn btn--header-primary" href="/subscribe" onClick={() => sendHeroEvent("CLICK", active?.id)}>
              Try for Free
            </Link>
          </div>
        </div>
      </div>
      {total > 1 ? (
        <div className="hero-dots" role="tablist" aria-label="Featured titles">
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              className={`hero-dot ${i === index ? "is-active" : ""}`}
              onClick={() => setIndex(i)}
              aria-label={`Show ${item.title}`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
