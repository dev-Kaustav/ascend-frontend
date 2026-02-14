import Link from "next/link";

export default function CTA() {
  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl section-pad">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#130a24] px-8 py-12 text-white shadow-soft sm:px-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(124,77,255,0.35)_0,_rgba(19,10,36,0.85)_55%,_rgba(11,6,20,0.98)_100%)]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="reveal-text">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                Ready to Scale
              </p>
              <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">
                Ready to scale your FMCG distribution?
              </h2>
              <p className="mt-3 max-w-xl text-sm text-white/75 sm:text-base">
                Partner with Ascend to unlock distribution access and intelligence
                in one unified platform.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/#contact"
                className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#6b3df0]"
              >
                Get in Touch
              </Link>
              <Link
                href="/#contact"
                className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/60"
              >
                Partner with Ascend
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
