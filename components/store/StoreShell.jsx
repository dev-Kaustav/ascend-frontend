"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPin, Search } from "lucide-react";
import BottomNavigation, { STORE_NAV_ITEMS } from "@/components/store/BottomNavigation";
import { useRetailerLinkGate } from "@/components/store/RetailerProvider";

// The delivery address picker and retailer login arrive with later slices; until then the
// header only advertises the empty state and stays fully navigable without any permission.
const LOCATION_PLACEHOLDER = "Select delivery address";

export default function StoreShell({ children }) {
  const pathname = usePathname() || "/";
  const gate = useRetailerLinkGate();

  return (
    <div className="ascend-storefront">
      <a className="sr-only focus:not-sr-only" href="#main">
        Skip to content
      </a>
      <header className="store-header">
        <div className="store-header__bar">
          <Link href="/" className="store-logo" aria-label="Ascend Foods home">
            <svg viewBox="0 0 34 34" aria-hidden="true">
              <path d="M5 28 16.8 5 29 28h-7.3l-4.9-10.2L12 28H5Z" fill="currentColor" />
              <path d="m10.5 22.2 6.3-4.4 6.6 4.4" fill="none" stroke="#FF6A1A" strokeWidth="2.4" />
            </svg>
            <span>ASCEND</span>
          </Link>

          <button type="button" className="store-location" disabled title={LOCATION_PLACEHOLDER}>
            <MapPin size={20} strokeWidth={1.75} aria-hidden="true" />
            <span>{LOCATION_PLACEHOLDER}</span>
          </button>

          {/* Native GET form: works before any client code runs. q is capped to the API limit. */}
          <form className="store-search" action="/products" method="get" role="search">
            <input
              type="search"
              name="q"
              maxLength={100}
              autoComplete="off"
              enterKeyHint="search"
              placeholder="Search snacks and brands"
              aria-label="Search products"
            />
            <button type="submit" aria-label="Search">
              <Search size={20} strokeWidth={2} aria-hidden="true" />
            </button>
          </form>

          <nav className="store-header__links" aria-label="Browse and account">
            {STORE_NAV_ITEMS.filter(({ label }) => label !== "Home").map(({ label, href, match }) => (
              <Link key={label} href={href} onClick={gate(href)} aria-current={match(pathname) ? "page" : undefined}>
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main id="main" className="store-main">
        {children}
      </main>

      <footer className="store-footer">
        <Link href="/landing">About Ascend</Link>
        <Link href="/login">Staff sign in</Link>
      </footer>

      <BottomNavigation />
    </div>
  );
}
