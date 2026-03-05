import Image from "next/image";
import Link from "next/link";
import type { HomeFeedResponse } from "@flyhigh/contracts";
import { HomeHeroCarousel } from "./home-hero-carousel";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

async function getHomeFeed(): Promise<HomeFeedResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  try {
    const response = await fetch(`${apiUrl}/v1/content/home`, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to load feed");
    return response.json();
  } catch {
    return { featured: null, rows: [] };
  }
}

const highlights = [
  {
    title: "Wakeboarding content you've been looking for.",
    body: "Enjoy classic films from wakeboarding's inception, edits, interviews, new release movie titles, and instructional content from top producers and riders in wakeboarding.",
    imagePath: "/home/featured-film.jpg",
    imageAlt: "Featured FlyHigh wakeboarding film still"
  },
  {
    title: "Watch everywhere.",
    body: "Get hyped for your next ride while on the go. Stream on your phone, laptop, tablet, Roku, and Fire TV.",
    imagePath: "/home/watch-everywhere.jpg",
    imageAlt: "Watch FlyHigh TV across devices"
  },
  {
    title: "Subscribe now",
    body: "Start your free trial, then continue for $7/mo. Full access to the catalog with the flexibility to cancel when you need to."
  }
];

const testimonials = [
  {
    quote: "What is FlyHigh TV?",
    name: "FlyHigh TV is an action sports streaming service that offers movies, edits, and exclusive wakeboarding content. Watch as much as you want, wherever you want."
  },
  {
    quote: "How much does FlyHigh TV cost?",
    name: "Watch FlyHigh TV on your phone, laptop, tablet, TV, or other streaming device for $7 a month. No extra costs, no contracts."
  },
  {
    quote: "How do I cancel?",
    name: "FlyHigh TV is flexible. Cancel anytime with no fees attached."
  }
];

export default async function Page() {
  const feed = await getHomeFeed();
  const featured = feed.featured;
  const featuredItems =
    feed.featuredItems && feed.featuredItems.length > 0
      ? feed.featuredItems
      : featured
        ? [featured]
        : [];

  return (
    <main className="page page--marketing">
      <div className="hero-shell">
        <SiteHeader />
        <HomeHeroCarousel items={featuredItems} />
      </div>

      <section className="theme:section theme-section--compact">
        <div className="theme-container content content--metrics">
          <article className="metric-card">
            <strong>150+</strong>
            <span>Wake movies, edits, and archival releases</span>
          </article>
          <article className="metric-card">
            <strong>14-Day</strong>
            <span>Free trial on the monthly plan</span>
          </article>
          <article className="metric-card">
            <strong>Roku + Fire TV</strong>
            <span>Stream on TV, laptop, tablet, or phone</span>
          </article>
        </div>
      </section>

      <section className="theme:section">
        <div className="theme-container content content--stack">
          {highlights.slice(0, 2).map((item, index) => (
            <div className={`content content--split-layout home-image-row ${index % 2 === 1 ? "home-image-row--reverse" : ""}`} key={item.title}>
              <article className="home-copy-card">
                <h2 className="theme:title feature-card__title">{item.title}</h2>
                <p className="theme:paragraph">{item.body}</p>
                {index === 0 ? (
                  <div className="hero__actions">
                    <Link className="btn btn--header-primary" href="/subscribe">Start Free Trial</Link>
                  </div>
                ) : null}
              </article>
              <div className="home-image-panel">
                <Image
                  src={item.imagePath!}
                  alt={item.imageAlt!}
                  fill
                  sizes="(max-width: 1023px) 100vw, 50vw"
                  className="home-image-panel__image"
                />
              </div>
            </div>
          ))}
          <Link className="feature-card feature-card--wide home-wide-callout home-wide-callout--cta" href="/subscribe">
            <h2 className="theme:title feature-card__title">{highlights[2].title}</h2>
            <p className="theme:paragraph">{highlights[2].body}</p>
          </Link>
        </div>
      </section>

      <section className="theme:section">
        <div className="theme-container content content--feature-grid">
          <div className="row__header row__header--full">
            <h2 className="theme:section-title section-title-left">Frequently Asked Questions</h2>
          </div>
          {testimonials.map((item) => (
            <article className="feature-card feature-card--quote" key={item.quote}>
              <h3>{item.quote}</h3>
              <p>{item.name}</p>
            </article>
          ))}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
