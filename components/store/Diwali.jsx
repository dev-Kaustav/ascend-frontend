"use client";

import Link from "next/link";
import { useId } from "react";
import { CategoryTile } from "@/components/store/Catalogue";

// Diwali pieces for the home. All art is drawn here or in store.css, so the season ships no images.

export function Diya({ className = "" }) {
  const glowId = useId();
  return (
    <svg className={`store-diya ${className}`} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <filter id={glowId} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="3.2" />
        </filter>
      </defs>
      <circle className="store-diya__glow" cx="24" cy="13" r="8.5" fill="#FFC861" filter={`url(#${glowId})`} />
      <g className="store-diya__flame">
        <path d="M24 3C28.5 9.5 29.4 14 24 20C18.6 14 19.5 9.5 24 3Z" fill="#FF9F1C" />
        <path d="M24 7C26.8 11.5 27 14.6 24 18.6C21 14.6 21.2 11.5 24 7Z" fill="#FFD25E" />
        <path d="M24 11.4C25.3 13.6 25.3 15.4 24 17.6C22.7 15.4 22.7 13.6 24 11.4Z" fill="#FFF7D6" />
      </g>
      <path d="M23.5 19.4h1v3.4h-1z" fill="#3A1A06" />
      <path d="M3 24C5.5 34 14 40 24 40S42.5 34 45 24C37 27.2 11 27.2 3 24Z" fill="#B8741A" />
      <path d="M6.5 29.5C10.5 36 16.8 38.8 24 38.8S37.5 36 41.5 29.5C34.5 33.6 13.5 33.6 6.5 29.5Z" fill="#8F5410" opacity="0.5" />
      <path
        d="M9 29.4q2 2.4 4 0q2 2.4 4 0q2 2.4 4 0q2 2.4 4 0q2 2.4 4 0q2 2.4 4 0q2 2.4 4 0"
        fill="none"
        stroke="#7A1430"
        strokeWidth="0.55"
      />
      <path d="M11 32.6h26" stroke="#F3C452" strokeWidth="0.7" strokeDasharray="0.1 2" strokeLinecap="round" />
      <ellipse cx="24" cy="24" rx="21" ry="3.2" fill="#F0BE4E" />
      <ellipse cx="24" cy="24.3" rx="15" ry="1.8" fill="#6E3A0C" />
      <path d="M5.5 23.3Q24 20.6 42.5 23.3" fill="none" stroke="#FFE7A0" strokeWidth="0.5" />
      <path d="M18 39.6h12l-2 3.4h-8z" fill="#9A5C14" />
      <path d="M19.4 41.2h9.2" stroke="#F0BE4E" strokeWidth="0.45" />
    </svg>
  );
}

export function Ornament({ className = "" }) {
  return (
    <svg className={`store-ornament ${className}`} viewBox="0 0 132 14" aria-hidden="true">
      <path d="M0 7h46M86 7h46" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="52" cy="7" r="2" fill="currentColor" />
      <circle cx="80" cy="7" r="2" fill="currentColor" />
      <path d="M66 0.5 72.5 7 66 13.5 59.5 7Z" fill="currentColor" />
      <path d="M66 4 69 7 66 10 63 7Z" fill="#F3C452" />
    </svg>
  );
}

/** The Diwali banner that leads the home: a scalloped arch holding the categories as festive picks. */
export function FestiveBanner({ headingId, facts, categories, covers }) {
  return (
    <section className="store-festive" data-home-section="promo" aria-labelledby={headingId}>
      <div className="store-festive__arch">
        <div className="store-festive__toran" aria-hidden="true" />
        <Diya className="store-festive__diya store-festive__diya--left" />
        <Diya className="store-festive__diya store-festive__diya--right" />
        <h1 id={headingId}>Diwali Stock-up</h1>
        <Ornament className="store-festive__rule" />
        <p className="store-festive__kicker">Your festive essentials</p>
        <p className="store-festive__facts">
          {facts ? `${facts} · ` : ""}Pay on delivery: cash or UPI
        </p>

        {categories.length > 0 ? (
          <ul className="store-festive__picks" style={{ "--cat-count": categories.length }}>
            {categories.map((category) => (
              <CategoryTile key={category.id} category={category} coverUrl={covers[category.id]} />
            ))}
          </ul>
        ) : null}

        <Link className="store-festive__cta" href="/products">
          Browse all products
        </Link>
      </div>
    </section>
  );
}
