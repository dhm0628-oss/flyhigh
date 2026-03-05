import { SiteFooter } from "../site-footer";
import { SiteHeader } from "../site-header";
import { ContactForm } from "./contact-form";

export default function ContactPage() {
  return (
    <main className="page page--marketing">
      <section className="watch-hero">
        <div className="watch-hero__inner">
          <SiteHeader compact />
          <div className="brand">Support</div>
          <h1>Contact FlyHigh TV</h1>
          <p className="watch-copy">
            This page is the support hub for account access, billing questions, playback issues, and TV activation help.
          </p>
        </div>
      </section>

      <section className="theme:section theme-section--compact">
        <div className="theme-container content">
          <ContactForm />
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
