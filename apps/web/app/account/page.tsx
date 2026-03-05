import { Suspense } from "react";
import { AccountClient } from "./account-client";

export default function AccountPage() {
  return (
    <Suspense fallback={<main className="page"><section className="content"><p className="card__meta">Loading account...</p></section></main>}>
      <AccountClient />
    </Suspense>
  );
}

