"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "../../../lib/http";

export function ResetPasswordClient() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState<"request" | "reset" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const token = searchParams.get("token")?.trim() ?? "";
  const hasToken = token.length > 0;

  useEffect(() => {
    const requestedEmail = searchParams.get("email")?.trim() ?? "";
    if (requestedEmail) {
      setEmail(requestedEmail);
    }
  }, [searchParams]);

  async function requestResetLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("request");
    setError(null);
    setNotice(null);

    try {
      await apiFetch("/v1/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email })
      });
      setNotice("If that email is in Flyhigh, we just sent a reset link.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset link");
    } finally {
      setBusy(null);
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("reset");
    setError(null);
    setNotice(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setBusy(null);
      return;
    }

    try {
      await apiFetch("/v1/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password })
      });
      window.location.href = "/account?reset=success";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password");
      setBusy(null);
    }
  }

  return (
    <main className="page page--account">
      <section className="watch-hero">
        <div className="watch-hero__inner">
          <Link href="/account" className="watch-back">Back to Account</Link>
          <div className="brand">Flyhigh.tv</div>
          <h1>{hasToken ? "Set a new password" : "Reset your password"}</h1>
          <p className="watch-copy">
            {hasToken
              ? "Choose a new password to finish signing in with your existing Flyhigh subscription."
              : "Enter your email and we’ll send you a reset link."}
          </p>
        </div>
      </section>

      <section className="content">
        <div className="auth-shell">
          <aside className="auth-brand-panel">
            <span className="auth-brand-panel__eyebrow">FlyHigh TV</span>
            <h2>Keep your access</h2>
            <p>
              Existing subscribers can reset their password once and continue with the same subscription.
            </p>
            <div className="watch-facts">
              <span>Existing Stripe billing stays in place</span>
              <span>One reset, then normal sign-in</span>
            </div>
          </aside>

          <div className="player-panel auth-panel">
            {error ? <p className="web-status web-status--error">{error}</p> : null}
            {notice ? <p className="web-status web-status--ok">{notice}</p> : null}

            {hasToken ? (
              <>
                <h3 className="auth-panel__title">Create your new password</h3>
                <p className="card__meta auth-panel__subtitle">
                  Use at least 12 characters with uppercase, lowercase, number, and symbol.
                </p>
                <form className="watch-login auth-form" onSubmit={resetPassword}>
                  <label>
                    Email
                    <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
                  </label>
                  <label>
                    New password
                    <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required />
                  </label>
                  <label>
                    Confirm new password
                    <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required />
                  </label>
                  <button className="btn btn--primary auth-submit" type="submit">
                    {busy === "reset" ? "Updating..." : "Set Password"}
                  </button>
                </form>
              </>
            ) : (
              <>
                <h3 className="auth-panel__title">Email me a reset link</h3>
                <p className="card__meta auth-panel__subtitle">
                  If this is a migrated subscriber account, the reset link is the fastest way through.
                </p>
                <form className="watch-login auth-form" onSubmit={requestResetLink}>
                  <label>
                    Email
                    <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
                  </label>
                  <button className="btn btn--primary auth-submit" type="submit">
                    {busy === "request" ? "Sending..." : "Send Reset Link"}
                  </button>
                </form>
              </>
            )}

            <div className="auth-form__helper">
              <Link href="/account?mode=login" className="auth-inline-link">Back to sign in</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
