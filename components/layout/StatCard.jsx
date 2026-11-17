export default function StatCard({ title, value, subtitle, hint, accent = "emerald" }) {
  const accentMap = {
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    sky: "bg-sky-100 text-sky-700",
    rose: "bg-rose-100 text-rose-700"
  };

  // Compact at phone widths, full size from sm: up. Three of these at the desktop scale
  // consumed ~420px stacked, pushing the screen's primary action below the fold.
  // Desktop (lg+): a label over the figure and nothing else; the "Live" chip and the tracked
  // capitals are kept only below lg, where the field apps use this card.
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-3.5 shadow-[0_12px_40px_-30px_rgba(15,23,42,0.4)] sm:rounded-3xl sm:p-5 lg:rounded-lg lg:border-line lg:bg-white lg:p-4 lg:shadow-none">
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] uppercase tracking-[0.18em] text-slate-400 sm:text-xs sm:tracking-[0.3em] lg:text-[13px] lg:normal-case lg:tracking-normal lg:text-muted">
            {title}
          </p>
          <p className="mt-1.5 text-xl font-semibold text-slate-900 tabular-nums sm:mt-3 sm:text-2xl lg:mt-1 lg:text-ink">{value}</p>
          {subtitle ? (
            // Hidden on phones: the title and value already carry the meaning, and the
            // subtitle is what makes three stacked cards overflow the first screen.
            <p className="mt-2 hidden text-xs text-slate-500 sm:block lg:mt-1 lg:text-muted">{subtitle}</p>
          ) : null}
        </div>
        <span
          className={`hidden rounded-2xl px-3 py-1 text-xs font-semibold sm:inline-block lg:hidden ${accentMap[accent] || accentMap.emerald}`}
        >
          {hint || "Live"}
        </span>
      </div>
    </div>
  );
}
