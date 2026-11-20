"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Route } from "lucide-react";
import { apiEndpoints } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { queryPath } from "@/lib/query";

// The beats, one row each: how many shops and what they owe. A row opens the beat (its shops),
// and a shop opens the shop: a drill-down one level per screen, each with a back arrow.

export const beatHref = (beat) => `/app/retailers/beats/${beat.id ?? "none"}`;

export function useBeats() {
  return useQuery({ queryKey: queryPath(apiEndpoints.retailers.beats), staleTime: 60_000 });
}

export default function BeatList() {
  const { data: beats, error, isPending } = useBeats();
  if (error) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">{error.message || "Unable to load beats."}</div>;
  if (isPending) return <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Loading beats…</div>;
  if (!beats.length) return <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">No beats yet.</p>;
  return (
    <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
      {beats.map((beat) => (
        <li key={beat.id ?? "none"}>
          <Link href={beatHref(beat)} className="flex min-h-16 items-center gap-3 px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <Route className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-slate-900">{beat.name}</span>
              <span className="block text-sm text-slate-500">{beat.shops} {beat.shops === 1 ? "shop" : "shops"}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className={`block text-sm font-semibold tabular-nums ${beat.outstanding > 0 ? "text-[#5e0b26]" : "text-slate-400"}`}>{formatCurrency(beat.outstanding)}</span>
              <span className="block text-xs text-slate-400">owed</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
