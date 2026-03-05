import { Suspense } from "react";
import { SiteFooter } from "../site-footer";
import { SiteHeader } from "../site-header";
import { RedeemClient } from "./redeem-client";

export default function RedeemPage() {
  return (
    <main className="page page--marketing">
      <section className="watch-hero">
        <div className="watch-hero__inner">
          <SiteHeader compact />
          <div className="brand">Redeem Gift Card</div>
          <h1>Redeem your FlyHigh TV code</h1>
          <p className="watch-copy">
            Sign in, enter your gift card code, and your account will receive the included subscription access.
          </p>
        </div>
      </section>

      <section className="theme:section theme-section--compact">
        <div className="theme-container content">
          <Suspense fallback={<p className="card__meta">Loading redemption flow...</p>}>
            <RedeemClient />
          </Suspense>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
