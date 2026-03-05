import Link from "next/link";
import { SiteFooter } from "../site-footer";
import { SiteHeader } from "../site-header";

const devices = [
  "Phone",
  "Laptop",
  "Tablet",
  "Roku",
  "Fire TV",
  "More TV platforms coming soon"
];

export default function WatchEverywherePage() {
  return (
    <main className="page page--marketing">
      <section className="watch-hero">
        <div className="watch-hero__inner">
          <SiteHeader compact />
          <div className="brand">Watch Everywhere</div>
          <h1>Watch everywhere.</h1>
          <p className="watch-copy">
            Get hyped for your next ride while on the go. Stream FlyHigh TV content on your phone, laptop, tablet, and TV.
          </p>
          <div className="hero__actions">
            <Link className="btn btn--primary" href="/activate">Activate TV</Link>
            <Link className="btn btn--ghost" href="/account">Manage Account</Link>
          </div>
        </div>
      </section>

      <section className="content">
        <div className="player-panel">
          <h2>Available Platforms</h2>
          <ul className="pricing-list">
            {devices.map((d) => <li key={d}>{d}</li>)}
          </ul>
        </div>
        <div className="player-panel">
          <h2>How TV activation works</h2>
          <div className="info-stack">
            <p className="watch-copy">Open the app on Roku or Fire TV, get a device code, then approve it from the web.</p>
            <div className="hero__actions">
              <Link className="btn btn--primary" href="/activate">Activate a device</Link>
              <Link className="btn btn--ghost" href="/faq">Read setup help</Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
