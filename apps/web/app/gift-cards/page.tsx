import { Suspense } from "react";
import { SiteFooter } from "../site-footer";
import { SiteHeader } from "../site-header";
import { GiftCardsClient } from "./gift-cards-client";

export default function GiftCardsPage() {
  return (
    <main className="page page--marketing">
      <section className="watch-hero">
        <div className="watch-hero__inner">
          <SiteHeader compact />
          <div className="brand">Gift Cards</div>
          <h1>Buy a FlyHigh TV gift card</h1>
          <p className="watch-copy">
            Send prepaid streaming access for the FlyHigh TV catalog. Choose a gift card, send it by email, and let the recipient redeem it on their own account.
          </p>
        </div>
      </section>

      <section className="theme:section theme-section--compact">
        <div className="theme-container content">
          <Suspense fallback={<p className="card__meta">Loading gift cards...</p>}>
            <GiftCardsClient />
          </Suspense>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
