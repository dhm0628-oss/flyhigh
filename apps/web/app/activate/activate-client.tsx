"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "../../lib/http";

type SessionResponse = {
  authenticated: boolean;
  viewer: null | {
    id: string;
    email: string;
    displayName: string;
    subscriptionStatus: "active" | "inactive" | "trialing" | "past_due";
  };
};

type CodeStatus = {
  code: string;
  status: string;
  expiresAt: string;
  clientName?: string;
};

function normalizeCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export function ActivateClient() {
  const searchParams = useSearchParams();
  const initialCode = normalizeCode(searchParams.get("code") ?? "");
  const [code, setCode] = useState(initialCode);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [codeStatus, setCodeStatus] = useState<CodeStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setSession(await apiFetch<SessionResponse>("/v1/auth/session", { method: "GET" }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load session");
      }
    })();
  }, []);

  async function lookupCode() {
    if (code.length < 6) {
      setError("Enter the 6-character device code shown on your TV");
      return;
    }
    setBusy("lookup");
    setError(null);
    setNotice(null);
    try {
      const status = await apiFetch<CodeStatus>(`/v1/device-auth/code/${code}`, { method: "GET" });
      setCodeStatus(status);
    } catch (err) {
      setCodeStatus(null);
      setError(err instanceof Error ? err.message : "Code lookup failed");
    } finally {
      setBusy(null);
    }
  }

  async function activateCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.length < 6) {
      setError("Enter the 6-character device code shown on your TV");
      return;
    }
    setBusy("activate");
    setError(null);
    setNotice(null);
    try {
      await apiFetch("/v1/device-auth/activate", {
        method: "POST",
        body: JSON.stringify({ code })
      });
      setApproved(true);
      setNotice("TV connected. Return to your Roku or Fire TV app.");
      await lookupCode();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Code activation failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="page page--activate-tv">
      <section className="watch-hero">
        <div className="watch-hero__inner">
          <Link href="/" className="watch-back">
            Back to Flyhigh.tv
          </Link>
          <div className="brand">Flyhigh.tv</div>
          <h1>Activate Your TV</h1>
          <p className="watch-copy">
            Enter the code shown on your Roku or Fire TV app to connect it to your Flyhigh.tv
            account.
          </p>
        </div>
      </section>

      <section className="content">
        {!session?.authenticated ? (
          <div className="player-panel">
            <h2>Sign in required</h2>
            <p className="card__meta">
              You need to sign in before approving a TV device code.
            </p>
            <div className="hero__actions">
              <Link className="btn btn--primary" href={`/account?mode=login&next=${encodeURIComponent(`/activate${code ? `?code=${code}` : ""}`)}`}>
                Sign In / Register
              </Link>
            </div>
          </div>
        ) : approved ? (
          <div className="player-panel activate-panel activate-panel--success">
            <h2>TV connected</h2>
            <p className="card__meta">
              Your device code <strong>{code}</strong> has been approved. You can return to your TV app now.
            </p>
            <div className="hero__actions">
              <Link className="btn btn--primary" href="/">
                Back to Flyhigh.tv
              </Link>
              <button
                className="btn btn--ghost"
                type="button"
                onClick={() => {
                  setApproved(false);
                  setNotice(null);
                  setCode("");
                  setCodeStatus(null);
                }}
              >
                Approve Another TV
              </button>
            </div>
          </div>
        ) : (
          <div className="player-panel">
            <h2>Approve a device code</h2>
            <p className="card__meta">
              Signed in as {session.viewer?.displayName} ({session.viewer?.subscriptionStatus})
            </p>
            <form className="watch-login" onSubmit={activateCode}>
              <label>
                Device Code
                <input
                  className="code-input"
                  value={code}
                  onChange={(event) => setCode(normalizeCode(event.target.value))}
                  placeholder="ABC123"
                  autoCapitalize="characters"
                  autoCorrect="off"
                />
              </label>
              <div className="hero__actions">
                <button className="btn btn--primary" type="submit" disabled={busy === "activate"}>
                  {busy === "activate" ? "Approving..." : "Approve Device"}
                </button>
                <button
                  className="btn btn--ghost"
                  type="button"
                  onClick={() => void lookupCode()}
                  disabled={busy === "lookup"}
                >
                  {busy === "lookup" ? "Checking..." : "Check Code"}
                </button>
              </div>
            </form>
          </div>
        )}

        {error ? <p className="web-status web-status--error">{error}</p> : null}
        {notice ? <p className="web-status web-status--ok">{notice}</p> : null}

        {codeStatus ? (
          <div className="player-panel">
            <h3>Code status</h3>
            <div className="account-grid">
              <div>
                <div className="label">Code</div>
                <div>{codeStatus.code}</div>
              </div>
              <div>
                <div className="label">Status</div>
                <div>{codeStatus.status}</div>
              </div>
              <div>
                <div className="label">App</div>
                <div>{codeStatus.clientName ?? "tv-app"}</div>
              </div>
              <div>
                <div className="label">Expires</div>
                <div>{new Date(codeStatus.expiresAt).toLocaleString()}</div>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
