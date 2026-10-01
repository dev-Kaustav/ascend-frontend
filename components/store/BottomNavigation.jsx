"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Home, LayoutGrid, User } from "lucide-react";
import { useRetailerLinkGate } from "@/components/store/RetailerProvider";

// Destinations for Orders and Account are owned by later storefront slices; the links are
// real so the navigation shape is final, and they resolve once those routes exist.
export const STORE_NAV_ITEMS = [
  { label: "Home", href: "/", icon: Home, match: (path) => path === "/" },
  {
    label: "Categories",
    href: "/products?view=categories",
    icon: LayoutGrid,
    match: (path) => path.startsWith("/products")
  },
  { label: "Orders", href: "/orders", icon: ClipboardList, match: (path) => path.startsWith("/orders") },
  { label: "Account", href: "/account", icon: User, match: (path) => path.startsWith("/account") }
];

// Phone navigation, fixed to the bottom. Hidden from 768px up, where StoreShell shows the
// same destinations in the header instead. Safe-area padding is applied in store.css.
export default function BottomNavigation() {
  const pathname = usePathname() || "/";
  const gate = useRetailerLinkGate();
  return (
    <nav className="store-bottom-nav" aria-label="Main">
      {STORE_NAV_ITEMS.map(({ label, href, icon: Icon, match }) => (
        <Link key={label} href={href} onClick={gate(href)} aria-current={match(pathname) ? "page" : undefined}>
          <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
