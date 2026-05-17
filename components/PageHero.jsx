import Link from "next/link";

export default function PageHero({
  title,
  description,
  ctaLabel = "Talk to Us",
  ctaHref = "/#contact"
}) {
  return (
    <section className="relative overflow-hidden bg-night text-white">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(124,77,255,0.35)_0,_rgba(11,6,20,0.65)_45%,_#0b0614_100%)]" />
      <div className="absolute -top-24 right-12 h-48 w-48 rounded-full bg-[radial-gradient(circle,_rgba(124,77,255,0.45)_0,_rgba(124,77,255,0.18)_45%,_rgba(124,77,255,0)_70%)]" />
      <div className="mx-auto flex max-w-5xl flex-col gap-6 py-16 section-pad sm:py-20 lg:py-24">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
          Ascend Foods
        </p>
        <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        <p className="max-w-2xl text-sm text-white/70 sm:text-base lg:text-lg">
          {description}
        </p>
        <div>
          <Link
            href={ctaHref}
            className="inline-flex rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white shadow-[0_20px_40px_-24px_rgba(124,77,255,0.6)] transition hover:bg-accent-strong"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
