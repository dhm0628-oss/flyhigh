import { Suspense } from "react";
import { ActivateClient } from "./activate-client";

export default function ActivatePage() {
  return (
    <Suspense fallback={<main className="page"><section className="content"><p className="card__meta">Loading activation flow...</p></section></main>}>
      <ActivateClient />
    </Suspense>
  );
}
