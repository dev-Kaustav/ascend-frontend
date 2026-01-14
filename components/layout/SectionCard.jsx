export default function SectionCard({ title, subtitle, children, actions }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_12px_40px_-30px_rgba(15,23,42,0.4)]">
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            {title ? <h2 className="text-lg font-semibold text-slate-900">{title}</h2> : null}
            {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}
