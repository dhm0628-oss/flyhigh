"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/http";

type MyListItem = {
  id: string;
  slug: string;
  title: string;
  posterUrl: string;
  durationSeconds: number;
  releaseYear?: number;
  isPremium: boolean;
};

type MyListResponse = {
  title: string;
  items: MyListItem[];
};

export function MyListRail() {
  const [data, setData] = useState<MyListResponse | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiFetch<MyListResponse>("/v1/viewer/my-list", { method: "GET" });
        if (res.items?.length) setData(res);
      } catch {
        setData(null);
      }
    })();
  }, []);

  if (!data?.items?.length) return null;

  return (
    <div className="row">
      <div className="row__header">
        <h2>{data.title}</h2>
        <Link className="btn btn--ghost" href="/account">
          Manage
        </Link>
      </div>
      <div className="rail">
        {data.items.map((item) => (
          <Link className="card card--link" key={item.id} href={`/watch/${item.slug}`}>
            <article>
              <div
                className="card__poster"
                style={item.posterUrl ? { backgroundImage: `url(${item.posterUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
              />
              <div className="card__body">
                <strong>{item.title}</strong>
                <div className="card__meta">
                  {item.releaseYear ?? "n/a"} | {Math.round(item.durationSeconds / 60)} min
                </div>
                <div className="card__meta">{item.isPremium ? "Subscriber only" : "Free"}</div>
              </div>
            </article>
          </Link>
        ))}
      </div>
    </div>
  );
}
