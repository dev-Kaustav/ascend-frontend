"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import dayjs from "dayjs";
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
  Operations: PackageIcon,
  Finance: CalculatorIcon,
  "Master Data": LayersIcon,
  Imports: UploadIcon,
  Admin: ShieldIcon,
  Profile: PersonIcon,
  "Bill Labels": LabelIcon,
  "My Retailers": StorefrontIcon,
  "Retailer Requests": InboxIcon,
  "Outlet Finder": PinIcon,
  "Tracking": PinIcon,
};

function NavGlyph({ label }) {
  const Icon = NAV_ICON_MAP[label] || GridIcon;
  return <Icon />;
}

const COLLAPSED_KEY = "app-shell-collapsed";

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

  const handleCollapseToggle = () => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
      return;
    }
    writeStored(COLLAPSED_KEY, String(!sidebarCollapsed));
  };

  return (
    <div className={cn("min-h-dvh bg-canvas text-slate-900 app-shell", fieldRole && "field-app")}>
      {fieldRole ? <FieldMobileNavigation role={role} /> : null}
      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-white/10 bg-sidebar transition-[transform,width] duration-200 ease-out ${
          sidebarCollapsed ? "lg:w-[84px]" : "lg:w-56"
        } ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className={`flex items-center border-b border-white/10 py-4 ${sidebarCollapsed ? "justify-between px-4 lg:justify-center lg:px-2" : "justify-between px-4"}`}>
          <Link href="/" className={`flex items-center gap-3 ${sidebarCollapsed ? "lg:justify-center lg:gap-0" : ""}`}>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-strong text-sm font-semibold text-white shadow-lg shadow-accent/30">
              AF
            </div>
            <div className={sidebarCollapsed ? "lg:hidden" : ""}>
              <div className="text-lg font-semibold tracking-tight text-white">Ascend</div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{roleLabel}</div>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="text-slate-500 transition hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <CloseIcon />
          </button>
        </div>

        <HoverScrollbar as="nav" className="flex-1 p-3">
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  title={item.label}
                  className={`flex rounded-xl py-2.5 text-base font-medium transition-all duration-200 ${
                    sidebarCollapsed ? "items-center gap-2.5 px-2.5 lg:justify-center lg:gap-0 lg:px-0" : "items-center gap-2.5 px-2.5"
                  } ${
                    isActive ? "bg-white/[0.09] text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  <span className="flex h-4 w-4 items-center justify-center">
                    <NavGlyph label={item.label} />
                  </span>
                  <span className={`truncate ${sidebarCollapsed ? "lg:hidden" : ""}`}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </HoverScrollbar>

        <div className="border-t border-white/10 px-3 py-4">
          <div className={`mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500 ${sidebarCollapsed ? "lg:hidden" : ""}`}>Account</div>

          <Link
            href="/app/profile"
            title="Profile"
            className={`flex items-center rounded-xl py-2.5 text-slate-300 transition-colors hover:bg-white/[0.04] hover:text-white ${
              sidebarCollapsed ? "gap-3 px-2 lg:justify-center lg:px-0" : "gap-3 px-2"
            }`}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.1] text-sm font-semibold text-accent/80">
              {getInitials(user?.email)}
            </div>
            <div className={`min-w-0 ${sidebarCollapsed ? "lg:hidden" : ""}`}>
              <div className="truncate text-sm font-semibold text-white">{user?.email || "User"}</div>
              <div className="truncate text-[11px] text-slate-500">{roleLabel}</div>
            </div>
          </Link>

          <div className={`mt-3 space-y-1 ${sidebarCollapsed ? "lg:flex lg:flex-col lg:items-center" : ""}`}>
            <button
              type="button"
              onClick={logout}
              title="Sign out"
              className={`flex items-center rounded-xl py-2.5 text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-white ${
                sidebarCollapsed ? "gap-3 px-2 lg:justify-center lg:px-0" : "gap-3 px-2"
              }`}
            >
              <SignOutIcon />
              <span className={`text-sm ${sidebarCollapsed ? "lg:hidden" : ""}`}>Sign out</span>
            </button>
            <button
              type="button"
              onClick={handleCollapseToggle}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={`flex items-center rounded-xl py-2.5 text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-white ${
                sidebarCollapsed ? "gap-3 px-2 lg:justify-center lg:px-0" : "gap-3 px-2"
              }`}
            >
              <CollapseIcon collapsed={sidebarCollapsed} />
              <span className={`text-sm ${sidebarCollapsed ? "lg:hidden" : ""}`}>Collapse</span>
            </button>
          </div>
        </div>
      </aside>

      <div className={`${sidebarCollapsed ? "lg:pl-[84px]" : "lg:pl-56"}`}>
        <header className={cn("sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur", fieldRole && "hidden lg:block")}>
          <div className="flex items-center justify-between gap-4 px-5 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="text-slate-600 transition hover:text-slate-900 lg:hidden"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open navigation"
              >
                <MenuIcon />
              </button>
              <div>
                <div className="text-xs text-slate-500">{dayjs().format("dddd, MMMM D, YYYY")}</div>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="text-base font-semibold text-slate-900">Welcome back</span>
                  <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
                    {roleLabel}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/app/profile"
                className="hidden cursor-pointer items-center gap-3 px-1 py-1.5 transition-colors hover:text-slate-900 sm:flex"
              >
                <div className="text-right">
                  <div className="max-w-[16rem] truncate text-sm font-semibold text-slate-900">{user?.email || "User"}</div>
                  <div className="mt-0.5 flex items-center justify-end gap-2">
                    <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{roleLabel}</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-strong text-xs font-semibold text-white shadow-lg shadow-accent/20">
                  {getInitials(user?.email)}
                </div>
              </Link>
              <Link
                href="/app/profile"
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-xs font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 sm:hidden"
                aria-label="Open profile"
              >
                {getInitials(user?.email)}
              </Link>
            </div>
          </div>
        </header>

        <main id="main-content" className="app-main p-5 pb-28 sm:p-6 lg:pb-6">
          <div className="space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
