"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ClipboardList, House, MapPinned, Package, Search, Store, Truck, UserRound } from "lucide-react";
import { getFieldNavForRole, getRoleLabel } from "@/lib/navigation";
import { cn } from "@/lib/cn";

const ICONS = { Home: House, Orders: ClipboardList, Deliveries: Truck, Retailers: Store, Outlets: MapPinned, Find: Search, Routes: MapPinned, Inventory: Package, Account: UserRound };

export default function FieldMobileNavigation({ role }) {
  const pathname = usePathname();
  const items = getFieldNavForRole(role);
  const current = items.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const isOrderChild = pathname.startsWith("/app/orders/");
  const title = pathname === "/app/orders/new" ? "New order" : isOrderChild ? "Order details" : current?.label || "Ascend";

  return (
    <>
      <header className="field-header lg:hidden">
        <div className="flex min-w-0 items-center gap-3">
          {isOrderChild ? (
            <Link href="/app/orders" aria-label="Back to orders" className="field-icon-button">
              <ArrowLeft className="size-5" aria-hidden="true" />
            </Link>
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
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const Icon = ICONS[label];
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("field-nav-item", active && "field-nav-item-active")}>
              <span className="field-nav-icon"><Icon className="size-5" aria-hidden="true" strokeWidth={active ? 2.25 : 1.75} /></span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
