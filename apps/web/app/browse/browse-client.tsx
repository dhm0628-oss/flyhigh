"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { HomeFeedResponse } from "@flyhigh/contracts";

type CatalogItem = HomeFeedResponse["rows"][number]["items"][number];

function dedupeItems(feed: HomeFeedResponse): CatalogItem[] {
  const map = new Map<string, CatalogItem>();
  for (const row of feed.rows) {
    for (const item of row.items) {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    }
  }
  if (feed.featured && !map.has(feed.featured.id)) {
    map.set(feed.featured.id, feed.featured);
  }
  return [...map.values()];
}

export function BrowseClient({ feed }: { feed: HomeFeedResponse }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [visibility, setVisibility] = useState<"all" | "premium" | "free">("all");
  const [tag, setTag] = useState("all");
  const [sort, setSort] = useState<"featured" | "newest" | "title">("featured");

  const allItems = useMemo(() => dedupeItems(feed), [feed]);
  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const item of allItems) {
      for (const t of item.tags ?? []) set.add(t);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [allItems]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let items = allItems.filter((item) => {
      if (q) {
        const hay = `${item.title} ${item.synopsis} ${(item.tags ?? []).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (type !== "all" && item.type !== type) return false;
      if (visibility === "premium" && !item.isPremium) return false;
      if (visibility === "free" && item.isPremium) return false;
      if (tag !== "all" && !(item.tags ?? []).includes(tag)) return false;
      return true;
    });

    if (sort === "newest") {
      items = [...items].sort((a, b) => (b.releaseYear ?? 0) - (a.releaseYear ?? 0) || a.title.localeCompare(b.title));
    } else if (sort === "title") {
      items = [...items].sort((a, b) => a.title.localeCompare(b.title));
    }
    return items;
  }, [allItems, query, type, visibility, tag, sort]);

  return (
    <main className="page">
      <section className="content">
        <div className="browse-head">
          <div>
            <h1>Browse Catalog</h1>
            <p className="card__meta">
              Search and filter your Flyhigh.tv catalog. {filtered.length} of {allItems.length} titles shown.
            </p>
          </div>
          <div className="hero__actions">
            <Link className="btn btn--ghost" href="/">
              Back Home
            </Link>
          </div>
        </div>

        <div className="browse-controls">
          <label>
            Search
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Title, tags, synopsis..."
            />
          </label>
          <label>
            Type
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="all">All</option>
              <option value="film">Film</option>
              <option value="series">Series</option>
              <option value="episode">Episode</option>
              <option value="trailer">Trailer</option>
              <option value="bonus">Bonus</option>
            </select>
          </label>
          <label>
            Access
            <select value={visibility} onChange={(e) => setVisibility(e.target.value as typeof visibility)}>
              <option value="all">All</option>
              <option value="premium">Subscriber only</option>
              <option value="free">Free</option>
            </select>
          </label>
          <label>
            Tag
            <select value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="all">All tags</option>
              {tags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="featured">Featured order</option>
              <option value="newest">Newest year</option>
              <option value="title">Title A-Z</option>
            </select>
          </label>
        </div>

        {filtered.length ? (
          <div className="browse-grid">
            {filtered.map((item) => (
              <Link className="catalog-card" key={item.id} href={`/watch/${item.slug}`}>
                <article>
                  <div
                    className="catalog-card__poster"
                    style={item.posterUrl ? { backgroundImage: `linear-gradient(rgba(7,19,26,.2), rgba(7,19,26,.85)), url(${item.posterUrl})` } : undefined}
                  />
                  <div className="catalog-card__body">
                    <strong>{item.title}</strong>
                    <div className="card__meta">
                      {item.type} | {item.releaseYear ?? "n/a"} | {Math.round(item.durationSeconds / 60)} min
                    </div>
                    <div className="card__meta">{item.isPremium ? "Subscriber only" : "Free"}</div>
                    {item.tags?.length ? (
                      <div className="tag-row">
                        {item.tags.slice(0, 3).map((t) => (
                          <span key={t} className="tag-pill">
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </article>
              </Link>
            ))}
          </div>
        ) : (
          <div className="player-panel">
            <p className="card__meta">No titles match your filters.</p>
          </div>
        )}
      </section>
    </main>
  );
}
