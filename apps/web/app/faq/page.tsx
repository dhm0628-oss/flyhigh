import Link from "next/link";
import { SiteFooter } from "../site-footer";
import { SiteHeader } from "../site-header";

const faqs = [
  {
    q: "What is included in membership?",
    a: "Membership includes access to over 150 wakeboarding movies and edits, plus new releases as they are published."
  },
  {
    q: "What is FlyHigh TV?",
    a: "FlyHigh TV is an action sports streaming service built around wakeboarding films, rider edits, and original content."
  },
  {
    q: "How much does FlyHigh TV cost?",
    a: "FlyHigh TV currently offers a monthly plan at $7/month with a 14-day free trial."
  },
  {
    q: "Where can I watch?",
    a: "You can watch on phone, laptop, tablet, and TV. Use Activate TV to link supported streaming devices."
  },
  {
    q: "How do I cancel?",
    a: "You can cancel anytime from your account with no contracts or cancellation fees."
  }
];

export default function FaqPage() {
  return (
    <main className="page page--marketing">
      <section className="watch-hero">
        <div className="watch-hero__inner">
          <SiteHeader compact />
          <div className="brand">FAQ</div>
          <h1>Frequently Asked Questions</h1>
          <p className="watch-copy">Quick answers about membership, streaming devices, and account setup.</p>
        </div>
      </section>

      <section className="content content--faq">
        <div className="faq-grid">
          {faqs.map((item) => (
            <article className="faq-card" key={item.q}>
              <h3>{item.q}</h3>
              <p>{item.a}</p>
            </article>
          ))}
        </div>
        <div className="faq-cta">
          <h2>Still need help?</h2>
          <p>Start with your account page, activation tools, or the contact page for direct support.</p>
          <div className="hero__actions">
            <Link className="btn btn--ghost" href="/account">Account</Link>
            <Link className="btn btn--primary" href="/activate">Activate TV</Link>
            <Link className="btn btn--ghost" href="/contact">Contact</Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
