"use client";

import { formatCurrency } from "@/lib/format";
import FieldSection from "@/components/field/FieldSection";
import RetailerList from "@/components/shops/RetailerList";
import { useBeats } from "@/components/shops/BeatList";

// One beat: its name and figures (from the beats list, already cached), then its shops as the same
// cards as everywhere else. `beatId` is "none" for the shops on no beat.
export default function BeatScreen({ beatId }) {
  const { data: beats } = useBeats();
  const beat = (beats || []).find((row) => String(row.id ?? "none") === String(beatId));
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      {beat ? (
        <FieldSection>
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-slate-900">{beat.name}</p>
              <p className="text-sm text-slate-500">{beat.shops} {beat.shops === 1 ? "shop" : "shops"}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className={`text-base font-semibold tabular-nums ${beat.outstanding > 0 ? "text-[#5e0b26]" : "text-slate-900"}`}>{formatCurrency(beat.outstanding)}</p>
              <p className="text-xs text-slate-400">owed</p>
            </div>
          </div>
        </FieldSection>
      ) : null}
      <RetailerList beatId={beatId} />
    </div>
  );
}
