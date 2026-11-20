"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ClipboardList, Ellipsis, House, IndianRupee, LogOut, MapPinned, Package, Search, Store, Truck, UserRound } from "lucide-react";
import { getChildScreen, getFieldNavForRole, getMoreNavForRole, getNavForRole, getRoleLabel } from "@/lib/navigation";
import useBackNavigation from "@/lib/hooks/useBackNavigation";
import { logout } from "@/lib/auth";
import { cn } from "@/lib/cn";
import MobileSheet from "@/components/layout/MobileSheet";

const ICONS = { Home: House, Orders: ClipboardList, Deliveries: Truck, Retailers: Store, Outlets: MapPinned, Find: Search, Routes: MapPinned, Inventory: Package, Account: UserRound, Finance: IndianRupee, More: Ellipsis };

const isAt = (pathname, href) => Boolean(href) && (pathname === href || pathname.startsWith(`${href}/`));

// The app shell on phones and tablets: a header with the screen's title (a back arrow on a screen
// below a tab) and the bottom tabs. An office role has more sections than tabs; the rest open from More.
export default function FieldMobileNavigation({ role }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const items = getFieldNavForRole(role);
  const moreItems = getMoreNavForRole(role);
  const onMorePage = moreItems.some((item) => isAt(pathname, item.href));
  const current = [...items, ...moreItems, ...getNavForRole(role)].find((item) => isAt(pathname, item.href));
  const child = getChildScreen(pathname);
  const title = child?.title || current?.label || "Ascend";
  const goBack = useBackNavigation(child?.parent || "/app/dashboard");

  return (
    <>
      <header className="field-header lg:hidden">
        <div className="flex min-w-0 items-center gap-3">
          {child ? (
            <button type="button" onClick={goBack} aria-label="Back" className="field-icon-button">
              <ArrowLeft className="size-5" aria-hidden="true" />
            </button>
          ) : (
            <Link href="/app/dashboard" aria-label="Ascend home" className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-base font-bold text-white">a<span className="text-emerald-400">.</span></Link>
          )}
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">Ascend · {getRoleLabel(role)}</p>
            <p className="truncate text-lg font-semibold text-slate-900">{title}</p>
          </div>
        </div>
        <Link href="/app/profile" aria-label="Open account" className="field-icon-button">
          <UserRound className="size-5" aria-hidden="true" />
        </Link>
      </header>
      <nav className="field-bottom-nav lg:hidden" aria-label="Field navigation">
        {items.map(({ href, label }) => {
          const active = href ? isAt(pathname, href) : onMorePage;
          const Icon = ICONS[label];
          const body = (
            <>
              <span className="field-nav-icon"><Icon className="size-5" aria-hidden="true" strokeWidth={active ? 2.25 : 1.75} /></span>
              <span>{label}</span>
            </>
          );
          return href ? (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("field-nav-item", active && "field-nav-item-active")}>
              {body}
            </Link>
          ) : (
            <button key={label} type="button" onClick={() => setMoreOpen(true)} aria-haspopup="dialog" className={cn("field-nav-item", active && "field-nav-item-active")}>
              {body}
            </button>
          );
        })}
      </nav>
      <MobileSheet open={moreOpen} title="More" onClose={() => setMoreOpen(false)}>
        <ul className="divide-y divide-slate-100">
          {moreItems.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={() => setMoreOpen(false)}
                aria-current={isAt(pathname, href) ? "page" : undefined}
                className={cn("flex min-h-12 items-center text-base font-semibold", isAt(pathname, href) ? "text-emerald-700" : "text-slate-900")}
              >
                {label}
              </Link>
            </li>
          ))}
          <li>
            <button type="button" onClick={logout} className="flex min-h-12 w-full items-center gap-2 text-base font-semibold text-rose-600">
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </button>
          </li>
        </ul>
      </MobileSheet>
    </>
  );
}
