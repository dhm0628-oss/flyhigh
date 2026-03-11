"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { apiFetch } from "../../lib/http";
import { BILLING_MODE } from "../../lib/runtime";

type SessionResponse = {
  authenticated: boolean;
  viewer: null | {
    id: string;
    email: string;
    displayName: string;
    subscriptionStatus: "active" | "inactive" | "trialing" | "past_due";
  };
};

type HistoryItem = {
  id: string;
  slug: string;
  title: string;
  posterUrl: string;
  durationSeconds: number;
  releaseYear?: number;
  isPremium: boolean;
  progressPercent: number;
  positionSeconds: number;
  completed: boolean;
  lastPlayedAt?: string;
};

type HistoryResponse = {
  title: string;
  items: HistoryItem[];
};

type BillingResponse = {
  hasSubscription: boolean;
  subscription: null | {
    id: string;
    status: string;
    provider: string;
    planCode: string;
    planName: string;
    interval: string;
    priceUsd: number;
    currency: string;
    currentPeriodEnd: string | null;
    canceledAt: string | null;
    cancelAtPeriodEnd: boolean;
    cancelAt: string | null;
    updatedAt: string;
  };
  invoices: Array<{
    id: string;
    createdAt: string;
    status: string;
    amountPaidUsd: number;
    amountDueUsd: number;
    currency: string;
    hostedInvoiceUrl: string | null;
    invoicePdf: string | null;
  }>;
  giftCardEntitlements: Array<{
    id: string;
    planName: string;
    status: string;
    currentPeriodEnd: string | null;
    updatedAt: string;
  }>;
};

export function AccountClient() {
  const searchParams = useSearchParams();
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [billing, setBilling] = useState<BillingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const finalizedCheckoutRef = useRef(false);

  useEffect(() => {
    const requestedMode = searchParams.get("mode");
    if (requestedMode === "register" || requestedMode === "login") {
      setMode(requestedMode);
    }
  }, [searchParams]);

  async function loadSession() {
    try {
      const nextSession = await apiFetch<SessionResponse>("/v1/auth/session", { method: "GET" });
      setSession(nextSession);
      if (nextSession.authenticated) {
        const [nextHistory, nextBilling] = await Promise.all([
          apiFetch<HistoryResponse>("/v1/viewer/history", { method: "GET" }).catch(() => null),
          apiFetch<BillingResponse>("/v1/subscriptions/me", { method: "GET" }).catch(() => null)
        ]);
        setHistory(nextHistory);
        setBilling(nextBilling);
      } else {
        setHistory(null);
        setBilling(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load account");
    }
  }

  useEffect(() => {
    void loadSession();
  }, []);

  useEffect(() => {
    const checkoutState = searchParams.get("checkout");
    const sessionId = searchParams.get("session_id");
    if (checkoutState !== "success" || !sessionId || finalizedCheckoutRef.current) {
      if (checkoutState === "cancel") {
        setNotice("Checkout canceled.");
      }
      return;
    }

    finalizedCheckoutRef.current = true;
    setBusy("subscription-finalize");
    setError(null);
    setNotice("Finalizing subscription...");

    void (async () => {
      try {
        await apiFetch<{ ok: true; subscriptionStatus: string; planCode: string }>(
          "/v1/subscriptions/finalize-checkout",
          {
            method: "POST",
            body: JSON.stringify({ sessionId })
          }
        );
        await loadSession();
        setNotice("Subscription activated.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to finalize subscription");
      } finally {
        setBusy(null);
      }
    })();
  }, [searchParams]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(mode);
    setError(null);
    setNotice(null);
    try {
      if (mode === "login") {
        await apiFetch("/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
        setNotice("Signed in.");
      } else {
        await apiFetch("/v1/auth/register", { method: "POST", body: JSON.stringify({ email, password, displayName }) });
        setNotice("Account created and signed in.");
      }
      await loadSession();
      const nextPath = searchParams.get("next");
      if (nextPath) {
        window.location.href = nextPath;
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auth request failed");
    } finally {
      setBusy(null);
    }
  }

  async function onLogout() {
    setBusy("logout");
    setError(null);
    setNotice(null);
    try {
      await apiFetch("/v1/auth/logout", { method: "POST", body: JSON.stringify({}) });
      await loadSession();
      setNotice("Signed out.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logout failed");
    } finally {
      setBusy(null);
    }
  }

  async function onRemoveHistoryItem(contentId: string) {
    setBusy(`history-remove-${contentId}`);
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/v1/viewer/progress/${contentId}`, { method: "DELETE" });
      await loadSession();
      setNotice("Removed from watch history.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove history item");
    } finally {
      setBusy(null);
    }
  }

  async function onClearHistory() {
    const confirmed = window.confirm("Clear all watch history?");
    if (!confirmed) return;

    setBusy("history-clear");
    setError(null);
    setNotice(null);
    try {
      await apiFetch("/v1/viewer/history", { method: "DELETE" });
      await loadSession();
      setNotice("Watch history cleared.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear watch history");
    } finally {
      setBusy(null);
    }
  }

  async function onManageBilling() {
    setBusy("billing-portal");
    setError(null);
    setNotice(null);
    try {
      const result = await apiFetch<{ url?: string }>("/v1/subscriptions/billing-portal-session", {
        method: "POST",
        body: JSON.stringify({})
      });
      if (!result.url) {
        throw new Error("Billing portal URL was not returned");
      }
      window.location.href = result.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open billing portal");
      setBusy(null);
    }
  }

  async function onCancelSubscription() {
    setBusy("billing-cancel");
    setError(null);
    setNotice(null);
    try {
      await apiFetch("/v1/subscriptions/cancel", { method: "POST", body: JSON.stringify({}) });
      await loadSession();
      setNotice("Subscription will cancel at period end.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule cancellation");
    } finally {
      setBusy(null);
    }
  }

  async function onResumeSubscription() {
    setBusy("billing-resume");
    setError(null);
    setNotice(null);
    try {
      await apiFetch("/v1/subscriptions/resume", { method: "POST", body: JSON.stringify({}) });
      await loadSession();
      setNotice("Subscription auto-renew resumed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resume subscription");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="page">
      <section className="watch-hero">
        <div className="watch-hero__inner">
          <Link href="/" className="watch-back">Back to Flyhigh.tv</Link>
          <div className="brand">Flyhigh.tv</div>
          <h1>Account</h1>
          <p className="watch-copy">Manage sign-in, subscription status, playback history, and billing.</p>
          <div className="watch-facts"><span>Billing mode: {BILLING_MODE}</span><span>{session?.authenticated ? `Subscription: ${session.viewer?.subscriptionStatus}` : "Signed out"}</span></div>
        </div>
      </section>
      <section className="content">
        {error ? <p className="web-status web-status--error">{error}</p> : null}
        {notice ? <p className="web-status web-status--ok">{notice}</p> : null}

        {session?.authenticated ? (
          <div className="stack">
            <div className="player-panel">
              <h2>{session.viewer?.displayName}</h2>
              <div className="account-grid">
                <div><div className="label">Email</div><div>{session.viewer?.email}</div></div>
                <div><div className="label">Subscription</div><div>{session.viewer?.subscriptionStatus}</div></div>
              </div>
              <div className="hero__actions">
                <Link className="btn btn--primary" href="/subscribe">View Plans</Link>
                <Link className="btn btn--ghost" href="/activate">Activate TV</Link>
                <button className="btn btn--ghost" type="button" onClick={() => void onLogout()}>{busy === "logout" ? "Signing out..." : "Sign Out"}</button>
              </div>
            </div>

            <div className="player-panel">
              <div className="row__header"><h2>Billing</h2></div>
              {billing?.subscription ? (
                <>
                  <div className="account-grid">
                    <div>
                      <div className="label">Plan</div>
                      <div>{billing.subscription.planName}</div>
                    </div>
                    <div>
                      <div className="label">Price</div>
                      <div>
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: billing.subscription.currency
                        }).format(billing.subscription.priceUsd)}
                        {" / "}
                        {billing.subscription.interval}
                      </div>
                    </div>
                    <div>
                      <div className="label">Status</div>
                      <div>{billing.subscription.status}</div>
                    </div>
                    <div>
                      <div className="label">Renews</div>
                      <div>{billing.subscription.currentPeriodEnd ? new Date(billing.subscription.currentPeriodEnd).toLocaleString() : "n/a"}</div>
                    </div>
                  </div>
                  <div className="watch-facts" style={{ marginTop: "0.75rem" }}>
                    {billing.subscription.cancelAtPeriodEnd ? (
                      <span>Cancels at period end ({billing.subscription.cancelAt ? new Date(billing.subscription.cancelAt).toLocaleDateString() : "scheduled"})</span>
                    ) : (
                      <span>Auto-renew enabled</span>
                    )}
                    {billing.subscription.status === "past_due" ? <span>Payment issue detected</span> : null}
                    {billing.subscription.status === "canceled" ? <span>Subscription canceled</span> : null}
                  </div>
                </>
              ) : (
                <p className="card__meta">No active billing record yet. Start from View Plans to subscribe.</p>
              )}
              <div className="hero__actions" style={{ marginTop: "0.75rem" }}>
                {billing?.subscription?.provider === "stripe" ? (
                  <button className="btn btn--ghost" type="button" onClick={() => void onManageBilling()}>
                    {busy === "billing-portal" ? "Opening Billing..." : "Open Billing Portal"}
                  </button>
                ) : null}
                {billing?.subscription?.provider === "stripe" ? (
                  billing.subscription.cancelAtPeriodEnd ? (
                    <button className="btn btn--primary" type="button" onClick={() => void onResumeSubscription()}>
                      {busy === "billing-resume" ? "Resuming..." : "Resume Subscription"}
                    </button>
                  ) : (
                    <button className="btn btn--ghost" type="button" onClick={() => void onCancelSubscription()}>
                      {busy === "billing-cancel" ? "Canceling..." : "Cancel Subscription"}
                    </button>
                  )
                ) : null}
                <Link className="btn btn--primary" href="/subscribe">View Plans</Link>
                {billing?.subscription?.provider === "gift_card" ? (
                  <Link className="btn btn--secondary" href="/gift-cards">Buy a Gift Card</Link>
                ) : null}
              </div>
              <div style={{ marginTop: "0.9rem" }}>
                <div className="row__header"><h3>Billing History</h3></div>
                {billing?.invoices?.length ? (
                  <div className="table" style={{ marginTop: "0.5rem" }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Status</th>
                          <th>Paid</th>
                          <th>Due</th>
                          <th>Invoice</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billing.invoices.map((inv) => (
                          <tr key={inv.id}>
                            <td>{new Date(inv.createdAt).toLocaleString()}</td>
                            <td>{inv.status}</td>
                            <td>{new Intl.NumberFormat("en-US", { style: "currency", currency: inv.currency }).format(inv.amountPaidUsd)}</td>
                            <td>{new Intl.NumberFormat("en-US", { style: "currency", currency: inv.currency }).format(inv.amountDueUsd)}</td>
                            <td>
                              {inv.hostedInvoiceUrl ? (
                                <a href={inv.hostedInvoiceUrl} target="_blank" rel="noreferrer">Open</a>
                              ) : inv.invoicePdf ? (
                                <a href={inv.invoicePdf} target="_blank" rel="noreferrer">PDF</a>
                              ) : (
                                "n/a"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="card__meta">No invoices yet.</p>
                )}
              </div>
              {billing?.giftCardEntitlements?.length ? (
                <div style={{ marginTop: "0.9rem" }}>
                  <div className="row__header"><h3>Gift Card Access</h3></div>
                  <div className="table" style={{ marginTop: "0.5rem" }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Plan</th>
                          <th>Status</th>
                          <th>Access Through</th>
                          <th>Updated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billing.giftCardEntitlements.map((item) => (
                          <tr key={item.id}>
                            <td>{item.planName}</td>
                            <td>{item.status}</td>
                            <td>{item.currentPeriodEnd ? new Date(item.currentPeriodEnd).toLocaleString() : "n/a"}</td>
                            <td>{new Date(item.updatedAt).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="player-panel">
              <div className="row__header">
                <h2>Watch History</h2>
                {history?.items?.length ? (
                  <button className="btn btn--ghost" type="button" onClick={() => void onClearHistory()}>
                    {busy === "history-clear" ? "Clearing..." : "Clear History"}
                  </button>
                ) : null}
              </div>
              {history?.items?.length ? (
                <div className="account-history">
                  {history.items.map((item) => (
                    <div key={item.id} className="account-history__item">
                      <Link href={`/watch/${item.slug}`} className="account-history__poster-link" aria-label={`Open ${item.title}`}>
                        <div
                          className="account-history__poster"
                          style={item.posterUrl ? { backgroundImage: `url(${item.posterUrl})` } : undefined}
                        />
                      </Link>
                      <div className="account-history__body">
                        <Link href={`/watch/${item.slug}`} className="account-history__title-link">
                          <strong>{item.title}</strong>
                        </Link>
                        <div className="card__meta">
                          {item.completed ? "Completed" : `${item.progressPercent}% watched`} | {Math.round(item.positionSeconds / 60)} min
                        </div>
                        <div className="card__meta">
                          {item.releaseYear ?? "n/a"} | {Math.round(item.durationSeconds / 60)} min | {item.isPremium ? "Subscriber" : "Free"}
                        </div>
                        <div className="progress-bar">
                          <div className="progress-bar__fill" style={{ width: `${Math.max(0, Math.min(100, item.progressPercent))}%` }} />
                        </div>
                        <div className="row-actions">
                          <Link className="btn btn--ghost" href={`/watch/${item.slug}`}>
                            Open
                          </Link>
                          <button
                            className="btn btn--ghost"
                            type="button"
                            onClick={() => void onRemoveHistoryItem(item.id)}
                          >
                            {busy === `history-remove-${item.id}` ? "Removing..." : "Remove"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="card__meta">No watch history yet. Start watching a title to see it here.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="auth-shell">
            <aside className="auth-brand-panel">
              <span className="auth-brand-panel__eyebrow">FlyHigh TV</span>
              <h2>Wakeboarding on Demand</h2>
              <p>
                Classic films, new releases, edits, and originals in one place.
              </p>
              <div className="watch-facts">
                <span>Secure billing via Stripe</span>
                <span>Cancel anytime</span>
              </div>
            </aside>
            <div className="player-panel auth-panel">
              <div className="tab-row auth-tabs">
                <button type="button" className={`tab-btn ${mode === "login" ? "is-active" : ""}`} onClick={() => setMode("login")}>Sign In</button>
                <button type="button" className={`tab-btn ${mode === "register" ? "is-active" : ""}`} onClick={() => setMode("register")}>Create Account</button>
              </div>
              <h3 className="auth-panel__title">{mode === "login" ? "Welcome back" : "Create your account"}</h3>
              <p className="card__meta auth-panel__subtitle">
                {mode === "login"
                  ? "Sign in to manage billing and keep watching."
                  : "Set up your FlyHigh account to start your trial and stream."}
              </p>
              <form className="watch-login auth-form" onSubmit={onSubmit}>
                <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
                {mode === "register" ? <label>Full name<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required /></label> : null}
                <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
                {mode === "register" ? <p className="card__meta auth-password-note">Use at least 12 chars with uppercase, lowercase, number, and symbol.</p> : null}
                <button className="btn btn--primary auth-submit" type="submit">{busy === mode ? (mode === "login" ? "Signing in..." : "Creating...") : (mode === "login" ? "Sign In" : "Create Account")}</button>
              </form>
              <p className="card__meta">Premium playback requires an active subscription.</p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
