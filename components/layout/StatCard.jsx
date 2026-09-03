export default function StatCard({ title, value, subtitle, hint, accent = "emerald" }) {
  const accentMap = {
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    sky: "bg-sky-100 text-sky-700",
    rose: "bg-rose-100 text-rose-700"
  };

  // Compact at phone widths, full size from sm: up. Three of these at the desktop scale
  // consumed ~420px stacked, pushing the screen's primary action below the fold.
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-3.5 shadow-[0_12px_40px_-30px_rgba(15,23,42,0.4)] sm:rounded-3xl sm:p-5">
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] uppercase tracking-[0.18em] text-slate-400 sm:text-xs sm:tracking-[0.3em]">
            {title}
          </p>
          <p className="mt-1.5 text-xl font-semibold text-slate-900 sm:mt-3 sm:text-2xl">{value}</p>
          {subtitle ? (
            // Hidden on phones: the title and value already carry the meaning, and the
            // subtitle is what makes three stacked cards overflow the first screen.
            <p className="mt-2 hidden text-xs text-slate-500 sm:block">{subtitle}</p>
          ) : null}
        </div>
        <span
          className={`hidden rounded-2xl px-3 py-1 text-xs font-semibold sm:inline-block ${accentMap[accent] || accentMap.emerald}`}
        >
          {hint || "Live"}
        </span>
      </div>
    </div>
  );
}
