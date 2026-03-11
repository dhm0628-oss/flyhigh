"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../lib/http";

type SessionResponse = {
  authenticated: boolean;
  viewer: null | {
    displayName: string;
    email: string;
  };
};

export function HeaderAuthCta() {
  const [session, setSession] = useState<SessionResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await apiFetch<SessionResponse>("/v1/auth/session", { method: "GET" });
        if (!cancelled) setSession(next);
      } catch {
        if (!cancelled) {
          setSession({ authenticated: false, viewer: null });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (session?.authenticated && session.viewer) {
    return (
      <>
        <Link className="btn btn--secondary btn--sm" href="/account">
          Signed in: {session.viewer.displayName}
        </Link>
        <Link className="btn btn--header-primary btn--sm" href="/browse">
          Browse
        </Link>
      </>
    );
  }

  return (
    <>
      <Link className="btn btn--secondary btn--sm" href="/account">
        Sign In
      </Link>
      <Link className="btn btn--header-primary btn--sm" href="/account?mode=register&next=%2Fsubscribe">
        Join now
      </Link>
    </>
  );
}

