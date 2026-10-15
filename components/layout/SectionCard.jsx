import { cn } from "@/lib/cn";

export default function SectionCard({ title, subtitle, children, actions, className }) {
  return (
    <section className={cn("app-section rounded-[1.5rem] border border-black/10 bg-white p-5 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.35)] sm:p-6", className)}>
      {(title || actions) && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            {title ? <h2 className="text-lg font-bold text-slate-900">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}
