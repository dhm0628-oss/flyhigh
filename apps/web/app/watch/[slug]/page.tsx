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
    <main className="page">
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
          <div className="watch-grid">
            <div className="watch-art">
              <div className="watch-art__frame">
                {item.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.posterUrl} alt={item.title} className="watch-art__img" />
                ) : (
                  <div className="card__poster" />
                )}
              </div>
            </div>
            <div className="watch-meta">
              <div className="brand">FlyHigh TV</div>
              <h1>{item.title}</h1>
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
              <MyListToggle contentId={item.id} />
            </div>
          </div>
        </div>
      </section>

      <section className="content">
        <div className="watch-play-banner">
          {item.previewUrl ? (
            <video
              className="watch-play-banner__media"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster={item.posterUrl}
            >
              <source src={item.previewUrl} type="application/x-mpegURL" />
            </video>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.posterUrl} alt={`${item.title} banner`} className="watch-play-banner__media" />
          )}
        </div>
        <PlaybackPanel
          contentId={item.id}
          title={item.title}
          isPremium={item.isPremium}
          durationSeconds={item.durationSeconds}
        />
      </section>

      <SiteFooter />
    </main>
  );
}
