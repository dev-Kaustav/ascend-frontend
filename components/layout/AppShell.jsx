"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import dayjs from "dayjs";
import { getAccessToken, getUserFromToken, logout } from "@/lib/auth";

function getInitials(email) {
  if (!email) return "U";
  const [name] = email.split("@");
  const parts = name.split(/[._-]/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]).join("");
  return initials.toUpperCase() || "U";
}

export default function AppShell({ navItems = [], roleLabel, children }) {
  const pathname = usePathname();
  const token = getAccessToken();
  const user = getUserFromToken(token);

  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-900 app-shell">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,#cffafe_0%,transparent_55%)]" />
        <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-[radial-gradient(circle,#fde68a_0%,transparent_60%)] opacity-70 blur-2xl" />
      </div>

      <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <aside className="hidden w-60 shrink-0 flex-col justify-between rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)] backdrop-blur lg:flex">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-sm font-semibold">
                AF
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Ascend Ops</p>
                <p className="text-xs uppercase tracking-widest text-slate-400">{roleLabel}</p>
              </div>
            </div>

            <nav className="mt-8 space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between rounded-2xl px-3 py-2 text-sm transition ${
                      isActive
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span>{item.label}</span>
                    <span className={`h-2 w-2 rounded-full ${isActive ? "bg-emerald-300" : "bg-slate-300"}`} />
                  </Link>
                );
              })}
            </nav>
          </div>

          <button
            type="button"
            onClick={logout}
            className="mt-6 inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
          >
            Sign out
          </button>
        </aside>

        <div className="flex-1">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white/80 px-5 py-4 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.45)] backdrop-blur">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Ascend Foods</p>
              <h1 className="mt-2 text-xl font-semibold text-slate-900">
                {dayjs().format("dddd, DD MMM")}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden flex-col text-right text-xs text-slate-500 sm:flex">
                <span className="font-semibold text-slate-700">{user?.email || "User"}</span>
                <span className="uppercase tracking-widest">{roleLabel}</span>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-xs font-semibold text-white">
                {getInitials(user?.email)}
              </div>
            </div>
          </header>

          <div className="flex flex-wrap gap-3 pb-4 lg:hidden">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-widest ${
                    isActive ? "bg-slate-900 text-white" : "bg-white text-slate-600"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={logout}
              className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500"
            >
              Sign out
            </button>
          </div>

          <div className="space-y-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
