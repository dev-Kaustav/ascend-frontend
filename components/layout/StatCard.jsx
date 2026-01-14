export default function StatCard({ title, value, subtitle, hint, accent = "emerald" }) {
  const accentMap = {
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    sky: "bg-sky-100 text-sky-700",
    rose: "bg-rose-100 text-rose-700"
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_12px_40px_-30px_rgba(15,23,42,0.4)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{title}</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{value}</p>
          {subtitle ? <p className="mt-2 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        <span className={`rounded-2xl px-3 py-1 text-xs font-semibold ${accentMap[accent] || accentMap.emerald}`}>
          {hint || "Live"}
        </span>
      </div>
    </div>
  );
}
