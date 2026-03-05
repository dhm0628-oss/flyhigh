import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer theme-footer">
      <div className="theme-container footer-wrapper">
        <div className="footer--copyright">
          <span className="footer--copyright-link">(c) FlyHigh TV, 2026</span>
        </div>
        <nav className="footer--menu" aria-label="Footer">
          <div className="theme-navigation footer-navigation-list">
            <Link href="/gift-cards">Buy a Gift Card</Link>
            <Link href="/redeem">Redeem Gift Card</Link>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms and Conditions</Link>
            <Link href="/contact">Contact</Link>
          </div>
        </nav>
        <div className="footer--services card__meta">Stream on web, Roku, and Fire TV.</div>
        <div className="footer--social">
          <a className="footer--social-link footer--social-link--icon" href="https://www.instagram.com/stream_flyhigh_tv" target="_blank" rel="noreferrer" aria-label="Instagram">
            <svg className="footer--social-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4.25" />
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            </svg>
          </a>
          <a className="footer--social-link footer--social-link--icon" href="https://www.facebook.com/Stream_FlyHigh" target="_blank" rel="noreferrer" aria-label="Facebook">
            <svg className="footer--social-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
              <path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.6 1.7-1.6H16.5V4.8c-.2 0-.9-.1-1.9-.1-1.9 0-3.3 1.1-3.3 3.4V11H9v3h2.3v7h2.2Z" />
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
}
