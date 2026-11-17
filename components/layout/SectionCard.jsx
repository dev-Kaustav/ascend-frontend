import { cn } from "@/lib/cn";

// Desktop (lg+): a flat white panel with a 1px edge and no shadow. Below lg the earlier soft card
// stays, so the field apps on phones and tablets do not change.
export default function SectionCard({ title, subtitle, children, actions, className }) {
  return (
    <section
      className={cn(
        "app-section border bg-white p-5 sm:p-6",
        "max-lg:rounded-[1.5rem] max-lg:border-black/10 max-lg:shadow-[0_24px_60px_-44px_rgba(15,23,42,0.35)]",
        "lg:rounded-lg lg:border-line lg:p-5",
        className
      )}
    >
      {(title || actions) && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4 lg:mb-4">
          <div>
            {title ? <h2 className="text-lg font-bold text-slate-900 lg:text-base lg:font-semibold lg:text-ink">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm text-slate-500 lg:mt-0.5 lg:text-muted">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}
