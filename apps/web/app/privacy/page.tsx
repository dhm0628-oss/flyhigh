import { SiteFooter } from "../site-footer";
import { SiteHeader } from "../site-header";

const sections = [
  {
    title: "1. Description of Service",
    paragraphs: [
      "This Privacy Policy explains what information Flyhigh.tv collects, how we store it, how we use it, and the choices available to you when you use the service.",
      "Flyhigh.tv takes your privacy seriously. We do not rent, sell, or share your personal information with third parties except as described in this policy.",
      "We may update this Privacy Policy from time to time. If you are a registered Flyhigh.tv user, we will attempt to notify you of material changes by email. You should also review this page periodically for the latest version.",
      "You may request that we review, remove, or modify personal information previously provided to us by contacting us directly. You may also update certain account information by signing into your Flyhigh.tv account and editing your account settings."
    ]
  },
  {
    title: "2. Data Collection and Use",
    paragraphs: [
      "We collect the personal data you choose to provide during registration and account use. Depending on the services you use, this may include your full name, address, email address, phone number, country, state, zip code, and billing information.",
      "Billing information may include payment details processed through our payment providers. Flyhigh.tv does not require you to provide information you do not want to submit, but declining to provide certain information may limit your ability to use parts of the service.",
      "All data is stored in the United States. We keep your data for up to 30 days after your account is deleted, after which it is removed from our system unless a longer retention period is required by law or for legitimate business purposes."
    ]
  },
  {
    title: "3. Analytics",
    paragraphs: [
      "We may collect and store information about your interaction with the Flyhigh.tv website and services, including cookies, IP addresses, browser type, device type, location, internet service provider, entry and exit pages, operating system, timestamps, and related usage data.",
      "We use this information to improve the quality, reliability, and performance of Flyhigh.tv services and products. If you disable cookies in your browser, some parts of the service may not work correctly."
    ]
  },
  {
    title: "4. Email Notices",
    paragraphs: [
      "When you register for Flyhigh.tv or make a purchase through the service, your email address may be used for account communications and service-related notices.",
      "You may also receive marketing emails about new features, products, titles, and other Flyhigh.tv updates. You may opt out of marketing emails at any time, but you may still receive account, billing, security, product, and legal notices.",
      "If you forget your account information, you may use the password reset tools available on the Flyhigh.tv website."
    ]
  },
  {
    title: "5. Business Transitions",
    paragraphs: [
      "If Flyhigh.tv is involved in a merger, acquisition, financing transaction, asset sale, or similar business transition, personally identifiable information we have on record may be transferred as part of that transaction."
    ]
  },
  {
    title: "6. Security",
    paragraphs: [
      "We use SSL encryption and other security measures designed to protect your data. While we take reasonable steps to safeguard information, no system can guarantee complete protection against unauthorized access.",
      "You are responsible for maintaining the security of your account credentials. We strongly recommend using a password that is difficult to guess."
    ]
  },
  {
    title: "7. Changes to Our Privacy Policy",
    paragraphs: [
      "Any changes we make to this Privacy Policy will be posted on this page and, where appropriate, communicated to you by email."
    ]
  },
  {
    title: "8. Your Rights",
    paragraphs: [
      "You may ask us not to process your personal data for marketing purposes by contacting us at help@flyhigh.tv."
    ],
    links: [
      { href: "mailto:help@flyhigh.tv", label: "help@flyhigh.tv" }
    ]
  },
  {
    title: "9. Contact Information",
    paragraphs: [
      "If you have any questions or concerns about this Privacy Policy or any Flyhigh.tv products, services, or features, please contact us at help@flyhigh.tv."
    ],
    links: [
      { href: "mailto:help@flyhigh.tv", label: "help@flyhigh.tv" }
    ]
  }
];

export default function PrivacyPage() {
  return (
    <main className="page page--marketing">
      <section className="watch-hero">
        <div className="watch-hero__inner">
          <SiteHeader compact />
          <div className="brand">Legal</div>
          <h1>Privacy Policy</h1>
          <p className="watch-copy">
            This Privacy Policy describes how Flyhigh.tv collects, uses, stores, and protects information when you use the service.
          </p>
        </div>
      </section>

      <section className="content">
        <article className="legal-card">
          <div className="legal-prose legal-prose--terms">
            {sections.map((section) => (
              <section key={section.title} className="legal-section">
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.links?.length ? (
                  <p>
                    {section.links.map((link, index) => (
                      <span key={link.href}>
                        {index > 0 ? " | " : ""}
                        <a href={link.href}>{link.label}</a>
                      </span>
                    ))}
                  </p>
                ) : null}
              </section>
            ))}
          </div>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
