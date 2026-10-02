"use client";

import dynamic from "next/dynamic";

// The one place a storefront sheet is mounted. The provider decides which sheet is active (login,
// shop, address or cart) and there is only ever one, so opening one replaces the other instead of
// stacking behind it. Each sheet is its own dialog (SheetFrame: modal, everything else inert, page
// scroll locked, one shared history entry so Back and Escape close the open sheet only, focus back
// to what opened it); the host adds nothing on top of that contract.
//
// Loaded only when a sheet opens, so public browsing never downloads them (or Firebase, or Maps).
const RetailerLoginSheet = dynamic(() => import("@/components/store/RetailerLoginSheet"), { ssr: false });
const ShopSheet = dynamic(() => import("@/components/store/ShopSheet"), { ssr: false });
const AddressSheet = dynamic(() => import("@/components/store/AddressSheet"), { ssr: false });
const CartSheet = dynamic(() => import("@/components/store/CartSheet"), { ssr: false });

/**
 * active: "login" | "shop" | "address" | "cart" | null.
 * generation: the identity the shop, address and cart sheets belong to; keying by it means a
 *   switched account starts a fresh form or cart view, never the previous one's.
 * intent: the destination held across login and onboarding.
 * onDismissLogin: close that also discards the held destination. onClose: plain close.
 */
export default function SheetHost({ active, generation, intent, onDismissLogin, onClose }) {
  if (active === "login") return <RetailerLoginSheet intent={intent} onClose={onDismissLogin} />;
  if (active === "shop") return <ShopSheet key={generation} intent={intent} onClose={onDismissLogin} />;
  if (active === "address") return <AddressSheet key={generation} onClose={onClose} />;
  if (active === "cart") return <CartSheet key={generation} onClose={onClose} />;
  return null;
}
