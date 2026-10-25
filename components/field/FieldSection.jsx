// The card every salesman screen is built from: a 12px uppercase title (with optional meta on the
// right) over its content, same padding and spacing everywhere. One type scale goes with it:
// 12px labels and meta, 14px body and values, 16px for inputs (stops iOS zooming on focus) and totals.

export const FIELD_CONTROL =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-[#7c3aed] focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/25 disabled:bg-slate-50 disabled:text-slate-500";

export default function FieldSection({ title, meta, children, ...rest }) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4" {...rest}>
      {title || meta ? (
        <div className="flex items-baseline justify-between gap-3">
          {title ? <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">{title}</h2> : <span />}
          {meta ? <p className="text-xs text-slate-400">{meta}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
