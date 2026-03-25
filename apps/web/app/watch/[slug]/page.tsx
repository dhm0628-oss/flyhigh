import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "../../site-footer";
import { SiteHeader } from "../../site-header";
import { MyListToggle } from "./my-list-toggle";
import { PlaybackPanel } from "./playback-panel";

type ContentDetail = {
  id: string;
  slug: string;
  title: string;
  synopsis: string;
  type: string;
  posterUrl: string;
  durationSeconds: number;
  releaseYear?: number;
  tags: string[];
  isPremium: boolean;
  playbackAvailable: boolean;
  publishStatus: string;
  videoStatus?: string;
  previewUrl?: string;
};

async function getContent(slug: string): Promise<ContentDetail | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  const response = await fetch(`${apiUrl}/v1/content/${slug}`, { cache: "no-store" });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error("Failed to load content");
  }
  return response.json();
}

export default async function WatchPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await getContent(slug);

  if (!item) {
    notFound();
  }

  return (
    <main className="page page--watch-experience">
      <section className="watch-hero">
        <div className="watch-hero__inner">
          <SiteHeader compact />
          <div className="watch-hero__top">
            <Link href="/browse" className="watch-back">
              &lt;- Back to catalog
            </Link>
            <div className="hero__actions">
              <Link className="btn btn--secondary btn--sm" href="/account">
                Account
              </Link>
              <Link className="btn btn--primary btn--sm" href="/subscribe">
                Plans
              </Link>
            </div>
          </div>
          <div className="watch-meta watch-meta--hero">
            <div className="brand">FlyHigh TV</div>
            <h1>{item.title}</h1>
            <div className="watch-facts">
              <span>{item.type}</span>
              <span>{item.releaseYear ?? "n/a"}</span>
              <span>{Math.round(item.durationSeconds / 60)} min</span>
              <span>{item.isPremium ? "Subscriber only" : "Free"}</span>
              <span>Video: {item.videoStatus ?? "none"}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="content">
        <PlaybackPanel
          contentId={item.id}
          title={item.title}
          isPremium={item.isPremium}
          playbackAvailable={item.playbackAvailable}
          durationSeconds={item.durationSeconds}
          posterUrl={item.posterUrl}
          synopsis={item.synopsis}
          type={item.type}
          releaseYear={item.releaseYear}
          videoStatus={item.videoStatus}
          tags={item.tags}
        />
        <div className="watch-detail-card player-panel">
          <div className="watch-detail-card__head">
            <div>
              <div className="brand">About this title</div>
              <h2>{item.title}</h2>
            </div>
            <MyListToggle contentId={item.id} />
          </div>
          <p className="watch-copy">{item.synopsis || "No synopsis yet."}</p>
          <div className="watch-facts">
            <span>{item.type}</span>
            <span>{item.releaseYear ?? "n/a"}</span>
            <span>{Math.round(item.durationSeconds / 60)} min</span>
            <span>{item.isPremium ? "Subscriber only" : "Free"}</span>
            <span>Video: {item.videoStatus ?? "none"}</span>
          </div>
          <div className="watch-tags">
            {item.tags.map((tag) => (
              <span key={tag} className="watch-tag">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
