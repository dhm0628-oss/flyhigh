"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "../../lib/http";

type SessionResponse = {
  authenticated: boolean;
  viewer: null | {
    displayName: string;
    subscriptionStatus: "active" | "inactive" | "trialing" | "past_due";
  };
};

export function RedeemClient() {
  const searchParams = useSearchParams();
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [mode, setMode] = useState<"login" | "register">("register");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadSession() {
    const nextSession = await apiFetch<SessionResponse>("/v1/auth/session", { method: "GET" });
    setSession(nextSession);
  }

  useEffect(() => {
    const queryCode = searchParams.get("code");
    if (queryCode) {
      setCode(queryCode.toUpperCase());
    }
  }, [searchParams]);

  useEffect(() => {
    void (async () => {
      try {
        await loadSession();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load session");
      }
    })();
  }, []);

  async function redeemGiftCard() {
    const result = await apiFetch<{ planName: string; durationMonths: number; currentPeriodEnd: string }>("/v1/gift-cards/redeem", {
      method: "POST",
      body: JSON.stringify({ code: code.trim().toUpperCase() })
    });
    setNotice(
      `Redeemed successfully. ${result.durationMonths} month(s) of ${result.planName} now active through ${new Date(result.currentPeriodEnd).toLocaleDateString()}.`
    );
    setCode("");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (!session?.authenticated) {
        if (mode === "login") {
          await apiFetch("/v1/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password })
          });
        } else {
          await apiFetch("/v1/auth/register", {
            method: "POST",
            body: JSON.stringify({ email, password, displayName })
          });
        }
        await loadSession();
      }

      await redeemGiftCard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to redeem gift card");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="contact-form-wrap">
      <form className="contact-form" onSubmit={onSubmit}>
        <h2>Redeem code</h2>
        <p className="card__meta">
          {session?.authenticated
            ? `Signed in as ${session.viewer?.displayName}.`
            : "Create an account or sign in, then redeem the code in the same step."}
        </p>
        {error ? <p className="web-status web-status--error">{error}</p> : null}
        {notice ? <p className="web-status web-status--ok">{notice}</p> : null}

        {!session?.authenticated ? (
          <>
            <div className="tab-row">
              <button type="button" className={`tab-btn ${mode === "register" ? "is-active" : ""}`} onClick={() => setMode("register")}>Register</button>
              <button type="button" className={`tab-btn ${mode === "login" ? "is-active" : ""}`} onClick={() => setMode("login")}>Sign In</button>
            </div>
            <label>Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            {mode === "register" ? (
              <label>Full name
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
              </label>
            ) : null}
            <label>Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            {mode === "register" ? <p className="card__meta">Use at least 12 chars with uppercase, lowercase, number, and symbol.</p> : null}
          </>
        ) : null}

        <label>Gift card code
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABCD-EFGH-JKLM" required />
        </label>

        <button className="btn btn--header-primary" type="submit" disabled={busy}>
          {busy ? "Processing..." : session?.authenticated ? "Redeem Gift Card" : mode === "register" ? "Create Account and Redeem" : "Sign In and Redeem"}
        </button>

        {!session?.authenticated ? (
          <div className="hero__actions">
            <Link className="btn btn--secondary" href="/gift-cards">Buy a Gift Card</Link>
          </div>
        ) : null}
      </form>
    </div>
  );
}
