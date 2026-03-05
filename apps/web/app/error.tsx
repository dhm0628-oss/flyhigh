"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep console visibility for local debugging and Sentry-like collectors.
    console.error("web.unhandled_error", error);
  }, [error]);

  return (
    <main className="page page--marketing">
      <section className="watch-hero">
        <div className="watch-hero__inner">
          <div className="brand">FlyHigh TV</div>
          <h1>Something went wrong</h1>
          <p className="watch-copy">
            We hit an unexpected error while loading this page.
            {error?.digest ? ` Reference: ${error.digest}` : ""}
          </p>
          <div className="hero__actions">
            <button type="button" className="btn btn--primary" onClick={() => reset()}>
              Try Again
            </button>
            <Link className="btn btn--secondary" href="/">
              Go Home
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

