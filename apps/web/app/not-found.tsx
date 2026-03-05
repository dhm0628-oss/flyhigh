import Link from "next/link";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

export default function NotFoundPage() {
  return (
    <main className="page page--marketing">
      <section className="watch-hero">
        <div className="watch-hero__inner">
          <SiteHeader compact />
          <div className="brand">FlyHigh TV</div>
          <h1>Page not found</h1>
          <p className="watch-copy">That page does not exist or may have moved.</p>
          <div className="hero__actions">
            <Link className="btn btn--primary" href="/">Go Home</Link>
            <Link className="btn btn--secondary" href="/browse">Browse Catalog</Link>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}

