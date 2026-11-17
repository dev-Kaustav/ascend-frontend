"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getAccessToken, getUserFromToken, logout } from "@/lib/auth";
import useStoredValue, { writeStored } from "@/lib/hooks/useStoredValue";
import HoverScrollbar from "@/components/ui/HoverScrollbar";
import FieldMobileNavigation from "@/components/layout/FieldMobileNavigation";
import { isFieldRole } from "@/lib/navigation";
import { cn } from "@/lib/cn";

function getInitials(email) {
  if (!email) return "U";
  const [name] = email.split("@");
  const parts = name.split(/[._-]/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]).join("");
  return initials.toUpperCase() || "U";
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path d="M10 17l5-5-5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 12H4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M20 5v14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CollapseIcon({ collapsed = false }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        d={collapsed ? "M10 6l6 6-6 6" : "M14 6l-6 6 6 6"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" fill="currentColor" />
    </svg>
  );
}

function OrdersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path d="M7 6h13l-1.2 7H8.2L7 6Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M7 6 6.2 4H4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="9.5" cy="18" r="1.5" fill="currentColor" />
      <circle cx="17.5" cy="18" r="1.5" fill="currentColor" />
    </svg>
  );
}

function PackageIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M4 7l8 4 8-4M12 11v10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function CalculatorIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <rect x="5" y="3" width="14" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <circle cx="9" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17" cy="9" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 19c.7-2.7 3-4 5-4s4.3 1.3 5 4M14 19c.4-1.8 1.7-2.9 3.6-3.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path d="M5 20V5l7-2v17M12 20h7V9l-7-2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 8h1M8 11h1M15 11h1M15 14h1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path d="M4 7h14a2 2 0 0 1 2 2v8H6a2 2 0 0 1-2-2V7Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 9V6a2 2 0 0 1 2-2h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16.5" cy="12.5" r="1" fill="currentColor" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path d="M4 13h4l1.5 2.5h5L16 13h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M4 13 6 5h12l2 8v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function StorefrontIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path d="M4 9h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 9 5 4.5h14L20.5 9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M10 20v-5h4v5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path d="M12 21s6-5.4 6-10a6 6 0 1 0-12 0c0 4.6 6 10 6 10Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="11" r="2.2" fill="currentColor" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 19c.8-3 3-4.5 6-4.5S17.2 16 18 19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path d="M3 7h11v8H3zM14 10h3l3 3v2h-6z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="8" cy="17" r="1.5" fill="currentColor" />
      <circle cx="18" cy="17" r="1.5" fill="currentColor" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path d="M7 3h7l4 4v14H7z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 3v4h4M9 12h6M9 16h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CreditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 10h18" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path d="M12 3 6 5v5c0 4 2.6 7.5 6 9 3.4-1.5 6-5 6-9V5l-6-2Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="0.8" fill="currentColor" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path d="m12 4 8 4-8 4-8-4 8-4Zm8 8-8 4-8-4M20 16l-8 4-8-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LabelIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path d="M3 7a2 2 0 0 1 2-2h9.586a2 2 0 0 1 1.414.586l3.414 3.414a2 2 0 0 1 0 2.828L15.414 18.41A2 2 0 0 1 14 19H5a2 2 0 0 1-2-2V7Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 10h5M8 14h3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 4v12M8 8l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const NAV_ICON_MAP = {
  Dashboard: DashboardIcon,
  Orders: OrdersIcon,
  Inventory: PackageIcon,
  Finance: CalculatorIcon,
  Catalog: LayersIcon,
  Imports: UploadIcon,
  Admin: ShieldIcon,
  Profile: PersonIcon,
  "Bill Labels": LabelIcon,
  "My Retailers": StorefrontIcon,
  Retailers: StorefrontIcon,
  "Retailer Requests": InboxIcon,
  "Outlet Finder": PinIcon,
  "Tracking": PinIcon,
};

function NavGlyph({ label }) {
  const Icon = NAV_ICON_MAP[label] || GridIcon;
  return <Icon />;
}

const COLLAPSED_KEY = "app-shell-collapsed";

// The Ascend peak and chevron (public/icon.svg), in the brand's maroon, cream and gold.
function AscendMark() {
  return (
    <svg viewBox="0 0 34 34" aria-hidden="true" className="h-8 w-8 shrink-0">
      <rect width="34" height="34" rx="7" fill="#5e0b26" />
      <path d="M5 28 16.8 5 29 28h-7.3l-4.9-10.2L12 28H5Z" fill="#fff6e7" />
      <path d="m10.5 22.2 6.3-4.4 6.6 4.4" fill="none" stroke="#f3c452" strokeWidth="2.4" />
    </svg>
  );
}

export default function AppShell({ navItems = [], roleLabel, role, children }) {
  const pathname = usePathname();
  const token = getAccessToken();
  const user = getUserFromToken(token);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const fieldRole = isFieldRole(role);
  // localStorage is the source of truth for this preference. The previous read-effect
  // rendered once collapsed=false and again with the stored value, and the paired
  // write-effect fired on mount too, rewriting the value it had just read.
  const sidebarCollapsed = useStoredValue(COLLAPSED_KEY) === "true";
  const activeItem = navItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  const handleCollapseToggle = () => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
      return;
    }
    writeStored(COLLAPSED_KEY, String(!sidebarCollapsed));
  };

  const rowClass = (active = false) =>
    cn(
      "flex h-10 items-center gap-3 rounded-md px-3 text-[15px] transition-colors",
      sidebarCollapsed && "lg:justify-center lg:gap-0 lg:px-0",
      active ? "bg-white/[0.1] font-medium text-white" : "text-white/65 hover:bg-white/[0.05] hover:text-white"
    );

  return (
    <div className={cn("min-h-dvh bg-canvas text-ink app-shell", fieldRole && "field-app")}>
      {fieldRole ? <FieldMobileNavigation role={role} /> : null}
      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-[#161412] transition-[transform,width] duration-200 ease-out",
          sidebarCollapsed ? "lg:w-[68px]" : "lg:w-60",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className={cn("flex h-14 items-center justify-between px-4", sidebarCollapsed && "lg:justify-center lg:px-2")}>
          <Link href="/app/dashboard" className="flex items-center gap-2.5" aria-label="Ascend workspace home">
            <AscendMark />
            <div className={cn("leading-tight", sidebarCollapsed && "lg:hidden")}>
              <div className="text-[15px] font-semibold text-white">Ascend Foods</div>
              <div className="text-xs text-white/50">{roleLabel} workspace</div>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="text-white/60 transition hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <CloseIcon />
          </button>
        </div>

        <HoverScrollbar as="nav" className="flex-1 px-3 py-2" aria-label="Workspace">
          <div className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = item === activeItem;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  title={item.label}
                  aria-current={isActive ? "page" : undefined}
                  className={rowClass(isActive)}
                >
                  <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center opacity-80 [&>svg]:h-[18px] [&>svg]:w-[18px]">
                    <NavGlyph label={item.label} />
                  </span>
                  <span className={cn("truncate", sidebarCollapsed && "lg:hidden")}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </HoverScrollbar>

        <div className="space-y-0.5 border-t border-white/10 px-3 py-3">
          <Link href="/app/profile" title="Profile" className={cn(rowClass(pathname === "/app/profile"), "h-11")}>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.12] text-xs font-semibold text-white">
              {getInitials(user?.email)}
            </span>
            <span className={cn("min-w-0", sidebarCollapsed && "lg:hidden")}>
              <span className="block truncate text-sm text-white">{user?.email || "Account"}</span>
              <span className="block truncate text-xs text-white/50">{roleLabel}</span>
            </span>
          </Link>
          <button type="button" onClick={logout} title="Sign out" className={cn(rowClass(), "w-full")}>
            <SignOutIcon />
            <span className={cn(sidebarCollapsed && "lg:hidden")}>Sign out</span>
          </button>
          <button
            type="button"
            onClick={handleCollapseToggle}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(rowClass(), "hidden w-full lg:flex")}
          >
            <CollapseIcon collapsed={sidebarCollapsed} />
            <span className={cn(sidebarCollapsed && "lg:hidden")}>Collapse</span>
          </button>
        </div>
      </aside>

      <div className={sidebarCollapsed ? "lg:pl-[68px]" : "lg:pl-60"}>
        {/* Phones and tablets only: the sidebar folds behind a menu button. The field roles have
            their own header (FieldMobileNavigation), so this bar is not shown for them. */}
        <header className={cn("sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-line bg-canvas px-4 lg:hidden", fieldRole && "hidden")}>
          <button
            type="button"
            className="-ml-1 flex h-10 w-10 items-center justify-center text-slate-600 hover:text-ink"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <MenuIcon />
          </button>
          <AscendMark />
          <span className="truncate text-sm font-semibold text-ink">{activeItem?.label || "Ascend"}</span>
        </header>

        <main id="main-content" className="app-main px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
          <div className="space-y-4">{children}</div>
        </main>
      </div>
    </div>
  );
}
