"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/http";

type ContinueItem = {
  id: string;
  slug: string;
  title: string;
  posterUrl: string;
  durationSeconds: number;
  releaseYear?: number;
  isPremium: boolean;
  progressPercent: number;
  positionSeconds: number;
};

type ContinueResponse = {
  title: string;
  items: ContinueItem[];
};

export function ContinueWatchingRail() {
  const [data, setData] = useState<ContinueResponse | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiFetch<ContinueResponse>("/v1/viewer/continue-watching", { method: "GET" });
        if (res.items?.length) {
          setData(res);
        }
      } catch {
        // Not signed in or no history; hide rail.
      }
    })();
  }, []);

  if (!data || !data.items?.length) return null;

  return (
    <div className="row">
      <div className="row__header">
        <h2>{data.title}</h2>
      </div>
      <div className="rail">
        {data.items.map((item) => (
          <Link className="card card--link" key={item.id} href={`/watch/${item.slug}`}>
            <article>
              <div className="card__poster" />
              <div className="progress-bar">
                <div className="progress-bar__fill" style={{ width: `${item.progressPercent}%` }} />
              </div>
              <div className="card__body">
                <strong>{item.title}</strong>
                <div className="card__meta">
                  {Math.round(item.progressPercent)}% watched | {Math.round(item.positionSeconds / 60)} min
                </div>
              </div>
            </article>
          </Link>
        ))}
      </div>
    </div>
  );
}
