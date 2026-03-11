"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/http";

type SessionResponse = {
  authenticated: boolean;
  viewer: null | {
    displayName: string;
    email: string;
  };
};

export function BrowseSessionNote() {
  const [session, setSession] = useState<SessionResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await apiFetch<SessionResponse>("/v1/auth/session", { method: "GET" });
        if (!cancelled) setSession(next);
      } catch {
        if (!cancelled) setSession({ authenticated: false, viewer: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!session) {
    return <span>Checking sign-in status...</span>;
  }

  if (!session.authenticated || !session.viewer) {
    return <span>Signed out</span>;
  }

  return <span>Signed in as {session.viewer.displayName}</span>;
}

