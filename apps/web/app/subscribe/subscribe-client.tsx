"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/http";
import { BILLING_MODE, isPlaceholderBilling } from "../../lib/runtime";

type Plan = { id: string; code: string; name: string; interval: string; priceUsd: number; currency: string };
type SessionResponse = { authenticated: boolean; viewer: null | { displayName: string; subscriptionStatus: "active" | "inactive" | "trialing" | "past_due" } };

export function SubscribeClient() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const [planRes, sessionRes] = await Promise.all([
          apiFetch<{ plans: Plan[] }>("/v1/subscriptions/plans", { method: "GET" }),
          apiFetch<SessionResponse>("/v1/auth/session", { method: "GET" })
        ]);
        setPlans(planRes.plans);
        setSession(sessionRes);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load plans");
      }
    })();
  }, []);

  const sortedPlans = useMemo(() => [...plans].sort((a, b) => a.priceUsd - b.priceUsd), [plans]);
  const status = session?.viewer?.subscriptionStatus;
  const hasActive = status === "active" || status === "trialing";

  async function startCheckout(planCode: string) {
    setBusyPlan(planCode);
    setNotice(null);
    setError(null);
    try {
      const result = await apiFetch<{ message?: string; checkoutUrl?: string | null }>("/v1/subscriptions/checkout-session", {
        method: "POST",
        body: JSON.stringify({ planCode, couponCode: couponCode.trim() || undefined })
      });
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      setNotice(isPlaceholderBilling() ? `Billing mode is '${BILLING_MODE}'. Checkout is intentionally disabled for now.` : (result.message ?? "Checkout placeholder response received."));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start checkout");
    } finally {
      setBusyPlan(null);
    }
  }

  return (
    <main className="page">
      <section className="watch-hero">
        <div className="watch-hero__inner">
          <Link href="/" className="watch-back">Back to Flyhigh.tv</Link>
          <div className="brand">Flyhigh.tv</div>
          <h1>Start your 14-day free trial</h1>
          <p className="watch-copy">Create your account, pick a plan, and start streaming in under a minute.</p>
          <div className="watch-facts"><span>Billing mode: {BILLING_MODE}</span><span>{session?.authenticated ? `Signed in (${status})` : "Not signed in"}</span></div>
        </div>
      </section>
      <section className="content">
        {error ? <p className="web-status web-status--error" role="alert" aria-live="polite">{error}</p> : null}
        {notice ? <p className="web-status web-status--ok" role="status" aria-live="polite">{notice}</p> : null}
        <div className="player-panel" style={{ marginBottom: "1rem" }}>
          <h2>Have a promo code?</h2>
          <p className="card__meta">Enter a coupon for discount or free-trial access.</p>
          <input
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            placeholder="WELCOME14"
            style={{ maxWidth: 280 }}
          />
        </div>
        {hasActive ? <div className="player-panel"><h2>Your subscription is active</h2><p className="card__meta">You already have access to premium titles.</p><div className="hero__actions"><Link className="btn btn--primary" href="/">Browse Titles</Link><Link className="btn btn--ghost" href="/account">Account</Link></div></div> : null}
        <div className="pricing-grid">
          {sortedPlans.map((plan) => (
            <article className="pricing-card" key={plan.id}>
              <div className="pricing-card__head">
                <h2>{plan.name}</h2>
              <div className="pricing-price">{new Intl.NumberFormat("en-US", { style: "currency", currency: plan.currency }).format(plan.priceUsd)}</div>
              <div className="card__meta">per {plan.interval}</div>
            </div>
            <ul className="pricing-list"><li>Premium wakeboard films</li><li>Web + future TV apps</li><li>Single Flyhigh.tv account</li></ul>
              <button className="btn btn--primary" type="button" onClick={() => void startCheckout(plan.code)} disabled={busyPlan === plan.code}>{busyPlan === plan.code ? "Processing..." : "Start 14-Day Trial"}</button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
