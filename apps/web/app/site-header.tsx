import Image from "next/image";
import Link from "next/link";
import { HeaderAuthCta } from "./header-auth-cta";

type SiteHeaderProps = {
  compact?: boolean;
};

export function SiteHeader({ compact = false }: SiteHeaderProps) {
  return (
    <header className={`theme-header ${compact ? "theme-header--compact" : "theme-header theme-header--transparent"}`}>
      <div className="theme-container theme-header__inner">
        <Link href="/" className="theme-header__brand-link">
          <Image
            src="/brand/main-logo.png"
            alt="FlyHigh TV"
            width={588}
            height={157}
            className="theme-header__brand-image"
            priority
          />
        </Link>
        <nav className="theme-header__nav" aria-label="Primary">
          <Link href="/">Home</Link>
          <Link href="/browse">Catalog</Link>
          <Link href="/team">Pro Team</Link>
        </nav>
        <div className="theme-header__cta">
          <HeaderAuthCta />
        </div>
      </div>
    </header>
  );
}
