"use client";

import Link from "next/link";

export default function RemovedRouteNotice({ title, description, href, ctaLabel }) {
  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.28)]">
      <div className="max-w-2xl space-y-4">
        <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">
          Route Removed
        </span>
        <div>
          <h1 className="text-[1.9rem] font-bold tracking-[-0.03em] text-slate-900">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        </div>
        <Link
          href={href}
          className="inline-flex items-center justify-center rounded-xl bg-[#1a1b2e] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#1a1b2e]/20 transition hover:bg-[#121322]"
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}
