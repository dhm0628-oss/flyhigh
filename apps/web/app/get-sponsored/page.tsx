import { SiteFooter } from "../site-footer";
import { SiteHeader } from "../site-header";
import { GetSponsoredForm } from "./sponsor-form";

export default function GetSponsoredPage() {
  return (
    <main className="page team-page">
      <section className="watch-hero team-page__hero">
        <div className="watch-hero__inner">
          <SiteHeader compact />
          <div className="team-page__intro">
            <h1>Get Sponsored</h1>
            <p className="watch-copy">
              Tell us about your riding, the tricks you can do, and the sponsorship level you are aiming for.
            </p>
          </div>
        </div>
      </section>

      <section className="theme:section theme-section--compact">
        <div className="theme-container content">
          <GetSponsoredForm />
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
