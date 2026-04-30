import { Suspense } from "react";
import { ResetPasswordClient } from "./reset-password-client";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="page"><section className="content"><p className="card__meta">Loading reset form...</p></section></main>}>
      <ResetPasswordClient />
    </Suspense>
  );
}
