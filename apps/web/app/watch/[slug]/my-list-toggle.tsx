"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/http";

type SessionResponse = {
  authenticated: boolean;
};

type MyListStatusResponse = {
  contentId: string;
  inMyList: boolean;
};

export function MyListToggle({ contentId }: { contentId: string }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [inMyList, setInMyList] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const session = await apiFetch<SessionResponse>("/v1/auth/session", { method: "GET" });
        setAuthenticated(Boolean(session.authenticated));
        if (!session.authenticated) return;
        const status = await apiFetch<MyListStatusResponse>(`/v1/viewer/my-list/${contentId}`, { method: "GET" });
        setInMyList(Boolean(status.inMyList));
      } catch {
        setAuthenticated(false);
      }
    })();
  }, [contentId]);

  async function toggle() {
    setBusy(true);
    setNotice(null);
    try {
      if (inMyList) {
        await apiFetch(`/v1/viewer/my-list/${contentId}`, { method: "DELETE" });
        setInMyList(false);
        setNotice("Removed from My List");
      } else {
        await apiFetch("/v1/viewer/my-list", {
          method: "POST",
          body: JSON.stringify({ contentId })
        });
        setInMyList(true);
        setNotice("Added to My List");
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  if (!authenticated) {
    return null;
  }

  return (
    <div className="my-list-toggle">
      <button className={`btn btn--secondary ${inMyList ? "is-active" : ""}`} type="button" onClick={() => void toggle()} disabled={busy}>
        {busy ? "Saving..." : inMyList ? "In My List" : "+ Add To My List"}
      </button>
      {notice ? <span className="card__meta">{notice}</span> : null}
    </div>
  );
}
