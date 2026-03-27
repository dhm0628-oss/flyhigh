import Link from "next/link";
import { SiteFooter } from "../site-footer";
import { SiteHeader } from "../site-header";

export default function AccountDeletionPage() {
  return (
    <main className="page page--marketing">
      <section className="watch-hero">
        <div className="watch-hero__inner">
          <SiteHeader compact />
          <div className="brand">Support</div>
          <h1>Request Account Deletion</h1>
          <p className="watch-copy">
            If you would like FlyHigh TV to delete your account and associated personal data, please submit a support request and include the email address on your account.
          </p>
        </div>
      </section>

      <section className="content">
        <article className="legal-card">
          <div className="legal-prose legal-prose--terms">
            <section className="legal-section">
              <h2>How to request deletion</h2>
              <p>
                Submit your request through our support page and select the account email you want removed. For security, we may ask you to confirm ownership of the account before deletion is completed.
              </p>
              <p>
                <Link href="/contact">Open the FlyHigh TV support form</Link>
              </p>
            </section>

            <section className="legal-section">
              <h2>What is deleted</h2>
              <p>
                When your request is processed, we will delete or anonymize your account profile and associated personal data, except where we need to retain limited records for billing, fraud prevention, tax, legal, or regulatory reasons.
              </p>
            </section>

            <section className="legal-section">
              <h2>Timing</h2>
              <p>
                We aim to process verified deletion requests within a reasonable time. If your subscription is active, you should also cancel any recurring billing before requesting deletion.
              </p>
            </section>
          </div>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
