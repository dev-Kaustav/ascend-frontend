import Link from "next/link";
import { Navigation, Phone, ShoppingBag } from "lucide-react";
import { mapsUrl } from "@/lib/geo";

// The pieces every shop card and the shop screen share, so a shop looks and acts the same wherever
// it appears: its lettered avatar, its phone number, and Call / Map / Order.

export const formatPhone = (value) => {
  if (!value && value !== 0) return null;
  const raw = String(value).replace(/\D/g, "");
  return raw.length === 10 ? `${raw.slice(0, 5)} ${raw.slice(5)}` : raw || null;
};

/** "today", "yesterday" or "12 days ago", for when a shop last ordered. */
export function daysAgo(value) {
  if (!value) return null;
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

// A steady tint per shop, so the avatar helps the eye find a card it has seen before.
const AVATAR_TINTS = [
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-800",
  "bg-sky-100 text-sky-700",
  "bg-rose-100 text-rose-700",
  "bg-teal-100 text-teal-700"
];
const avatarTint = (name = "") =>
  AVATAR_TINTS[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_TINTS.length];

export function ShopAvatar({ name }) {
  return (
    <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-semibold ${avatarTint(name)}`}>
      {(name || "?").trim().charAt(0).toUpperCase()}
    </span>
  );
}

const CARD_ACTION =
  "flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-colors";

/** Call, Map and (when the role books orders) Order, as one row of thumb-sized buttons. */
export function ShopActions({ shop, canOrder }) {
  const phone = formatPhone(shop.mobile_number);
  return (
    <div className={`grid gap-2 ${canOrder ? "grid-cols-3" : "grid-cols-2"}`}>
      {phone ? (
        <a href={`tel:${shop.mobile_number}`} aria-label={`Call ${shop.name}, ${phone}`} className={`${CARD_ACTION} bg-slate-100 text-slate-700`}>
          <Phone className="h-4 w-4" strokeWidth={2} />
          Call
        </a>
      ) : (
        <span className={`${CARD_ACTION} bg-slate-50 text-slate-300`} aria-label="No phone number">
          <Phone className="h-4 w-4" strokeWidth={2} />
          Call
        </span>
      )}
      <a href={mapsUrl(shop)} target="_blank" rel="noreferrer" aria-label={`Open ${shop.name} in Google Maps`} className={`${CARD_ACTION} bg-slate-100 text-slate-700`}>
        <Navigation className="h-4 w-4" strokeWidth={2} />
        Map
      </a>
      {canOrder ? (
        <Link href={`/app/orders/new?retailer=${shop.id}`} className={`${CARD_ACTION} bg-slate-900 text-white`}>
          <ShoppingBag className="h-4 w-4" strokeWidth={2} />
          Order
        </Link>
      ) : null}
    </div>
  );
}
