"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MapPin, Search, ShoppingCart, X } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import BottomNavigation, { STORE_NAV_ITEMS } from "@/components/store/BottomNavigation";
import { useRetailer, useRetailerLinkGate } from "@/components/store/RetailerProvider";
import { listingHref, parseListingParams } from "@/lib/store/catalogue.mjs";
import { formatCurrency } from "@/lib/format";
import { cartBarSummary } from "@/lib/store/cart.mjs";
import { headerAddressLabel } from "@/lib/store/maps.mjs";
import { FESTIVE, festiveFont } from "@/components/store/festive";

// What the search box suggests while it waits, Blinkit style: a product name is revealed left to
// right behind a soft-edged curtain, as if typed fast, holds, then the curtain sweeps back before
// the next. It is drawn over the empty box (aria-hidden; the input keeps its label) and stays on the
// first name for reduced motion.
const SEARCH_HINTS = [
  "tandoori peanuts",
  "black pepper cashew",
  "hing jeera chana",
  "green peas",
  "classic salted cashew",
  "cheese balls"
];
const CHAR_MS = 26; // reveal time per letter
const HOLD_MS = 1700; // how long a fully revealed name stays
const ERASE_MS = 12; // sweep-back time per letter
const EDGE_MS = 220; // the curtain's soft edge crossing the word

function useHintCycle() {
  const [cycle, setCycle] = useState({ index: 0, leaving: false });
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    let index = 0;
    let timer;
    const length = () => SEARCH_HINTS[index].length + 1; // the closing quote types in too
    const leave = () => {
      setCycle({ index, leaving: true });
      timer = setTimeout(next, length() * ERASE_MS + EDGE_MS);
    };
    const next = () => {
      index = (index + 1) % SEARCH_HINTS.length;
      setCycle({ index, leaving: false });
      timer = setTimeout(leave, length() * CHAR_MS + EDGE_MS + HOLD_MS);
    };
    timer = setTimeout(leave, length() * CHAR_MS + EDGE_MS + HOLD_MS);
    return () => clearTimeout(timer);
  }, []);
  return cycle;
}

function HintWord({ text, leaving }) {
  const word = `${text}\u201d`;
  return (
    <span
      className="store-search__word"
      data-leaving={leaving ? "" : undefined}
      style={{
        "--reveal-ms": `${word.length * CHAR_MS + EDGE_MS}ms`,
        "--erase-ms": `${word.length * ERASE_MS + EDGE_MS}ms`
      }}
    >
      {word}
    </span>
  );
}

// Native GET form, so search works before any client code runs; once hydrated it navigates in
// place (the persistent layout keeps the cart and sheets). The box shows the q in the URL on
// /products and can be cleared; clearing on a results page drops q and keeps category and brand.
function SearchForm({ initial, onClear }) {
  const router = useRouter();
  const inputRef = useRef(null);
  const [value, setValue] = useState(initial);
  const hint = useHintCycle();
  return (
    <form
      className="store-search"
      action="/products"
      method="get"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        router.push(listingHref({ q: value }));
      }}
    >
      <span className="store-search__field">
        {!value ? (
          <span className="store-search__hint" aria-hidden="true">
            Search &ldquo;
            <HintWord key={hint.index} text={SEARCH_HINTS[hint.index]} leaving={hint.leaving} />
          </span>
        ) : null}
        <input
          ref={inputRef}
          type="search"
          name="q"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={100}
          autoComplete="off"
          enterKeyHint="search"
          aria-label="Search products"
        />
      </span>
      {value ? (
        <button
          type="button"
          className="store-search__clear"
          aria-label="Clear search"
          onClick={() => {
            setValue("");
            inputRef.current?.focus();
            onClear?.();
          }}
        >
          <X size={20} strokeWidth={2} aria-hidden="true" />
        </button>
      ) : null}
      <button type="submit" aria-label="Search">
        <Search size={20} strokeWidth={2} aria-hidden="true" />
      </button>
    </form>
  );
}

function HeaderSearch() {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const router = useRouter();
  const listing = pathname === "/products" ? parseListingParams(searchParams) : null;
  return (
    <SearchForm
      key={listing?.q ?? ""}
      initial={listing?.q ?? ""}
      onClear={listing?.q ? () => router.replace(listingHref({ ...listing, q: "", page: 1 })) : undefined}
    />
  );
}

// The cart is reached from two places: the View cart bar above the bottom navigation on phones and a
// Cart control in the header from 768px up (store.css shows one at a time). Both open the same cart
// sheet through the provider, which keeps one sheet on screen.
function CartBar() {
  const { cart, openSheet } = useRetailer();
  if (!cart) return null;
  const { visible, units, total: quoted } = cartBarSummary({ cart: { lines: cart.lines }, readiness: cart.readiness });
  if (!visible) return null;
  const total = quoted === null ? null : formatCurrency(quoted);
  return (
    <div className="store-cart-bar">
      <button
        type="button"
        onClick={() => openSheet("cart")}
        aria-label={`View cart, ${units} ${units === 1 ? "piece" : "pieces"}${total ? `, ${total}` : ""}`}
        data-quote-current={cart.readiness.ready ? "true" : "false"}
      >
        <span className="store-cart-bar__label">
          <ShoppingCart size={20} strokeWidth={2} aria-hidden="true" />
          View cart
        </span>
        <span className="store-cart-bar__sum">
          {units} {units === 1 ? "pc" : "pcs"}
          {total ? ` · ${total}` : ""}
        </span>
      </button>
    </div>
  );
}

function HeaderCart() {
  const { cart, openSheet, requireRetailer, readiness } = useRetailer();
  const units = cart ? cartBarSummary({ cart: { lines: cart.lines }, readiness: cart.readiness }).units : 0;
  return (
    <button
      type="button"
      className="store-header__cart"
      disabled={readiness === "loading"}
      aria-label={units > 0 ? `Cart, ${units} ${units === 1 ? "piece" : "pieces"}` : "Cart"}
      onClick={() => {
        if (cart) openSheet("cart");
        else requireRetailer(null);
      }}
    >
      <ShoppingCart size={20} strokeWidth={1.75} aria-hidden="true" />
      Cart
      {units > 0 ? <span className="store-header__count">{units}</span> : null}
    </button>
  );
}

export default function StoreShell({ children }) {
  const pathname = usePathname() || "/";
  const gate = useRetailerLinkGate();
  // The header shows the delivery address the retailer chose (the full text is in the picker) and
  // asks for one otherwise. It never asks the browser for a position: only the sheet's Detect my
  // location button does, and only when pressed.
  const { selectedAddress, openAddresses, readiness } = useRetailer();
  const locationLabel = headerAddressLabel(selectedAddress);

  return (
    <div className={FESTIVE ? `ascend-storefront ${festiveFont.variable}` : "ascend-storefront"} data-festive={FESTIVE || undefined}>
      <a className="sr-only focus:not-sr-only" href="#main">
        Skip to content
      </a>
      <header className="store-header">
        {FESTIVE ? <div className="store-lights" aria-hidden="true" /> : null}
        <div className="store-header__bar">
          <Link href="/" className="store-logo" aria-label="Ascend Foods home">
            <svg viewBox="0 0 34 34" aria-hidden="true">
              <path d="M5 28 16.8 5 29 28h-7.3l-4.9-10.2L12 28H5Z" fill="currentColor" />
              <path d="m10.5 22.2 6.3-4.4 6.6 4.4" fill="none" stroke="#FF6A1A" strokeWidth="2.4" />
            </svg>
            <span>ASCEND</span>
          </Link>

          <button
            type="button"
            className="store-location"
            onClick={openAddresses}
            disabled={readiness === "loading"}
            title={locationLabel}
            aria-label={selectedAddress ? `Delivery address: ${locationLabel}. Change` : locationLabel}
          >
            <MapPin size={20} strokeWidth={1.75} aria-hidden="true" />
            <span>{locationLabel}</span>
          </button>

          {/* useSearchParams is confined to this boundary, so the rest of the shell never bails out
              of static rendering; the fallback is the same empty form. */}
          <Suspense fallback={<SearchForm initial="" />}>
            <HeaderSearch />
          </Suspense>

          <nav className="store-header__links" aria-label="Browse and account">
            {STORE_NAV_ITEMS.filter(({ label }) => label !== "Home").map(({ label, href, match }) => (
              <Link key={label} href={href} onClick={gate(href)} aria-current={match(pathname) ? "page" : undefined}>
                {label}
              </Link>
            ))}
            <HeaderCart />
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

      <CartBar />
      <BottomNavigation />
    </div>
  );
}
