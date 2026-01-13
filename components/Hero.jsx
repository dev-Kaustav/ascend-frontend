import Image from "next/image";
import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-night text-white">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(124,77,255,0.35)_0,_rgba(11,6,20,0.65)_45%,_#0b0614_100%)]" />
      <div className="absolute -top-32 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(124,77,255,0.45)_0,_rgba(124,77,255,0.18)_45%,_rgba(124,77,255,0)_70%)]" />
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-10 py-16 section-pad sm:gap-12 sm:py-20 lg:py-28">
        <div className="flex max-w-3xl flex-col items-center gap-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
            Ascend Foods
          </p>
          <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
            Data-driven FMCG distribution for{" "}
            <span className="text-accent">faster market expansion</span>
          </h1>
          <p className="text-sm leading-relaxed text-white/70 sm:text-base lg:text-lg">
            Ascend helps FMCG brands scale across India by combining distribution
            access with real-time sales and outlet intelligence.
          </p>
          <div className="flex w-full flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/contact"
              className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white shadow-[0_20px_40px_-24px_rgba(124,77,255,0.6)] transition hover:bg-[#6b3df0]"
            >
              Talk to Us
            </Link>
            <Link
              href="/contact"
              className="rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/10"
            >
              Partner with Ascend
            </Link>
          </div>
        </div>
        <div className="relative flex w-full justify-center">
          <div className="group relative w-full max-w-4xl">
            <div className="absolute -left-16 top-12 h-48 w-48 rounded-full bg-[radial-gradient(circle,_rgba(124,77,255,0.5)_0,_rgba(124,77,255,0.18)_50%,_rgba(124,77,255,0)_72%)] transition duration-500 group-hover:-translate-y-6 group-hover:translate-x-4" />
            <div className="absolute -right-12 bottom-4 h-40 w-40 rounded-full bg-[radial-gradient(circle,_rgba(217,70,239,0.4)_0,_rgba(217,70,239,0.16)_50%,_rgba(217,70,239,0)_72%)] transition duration-500 group-hover:-translate-y-4 group-hover:-translate-x-2" />
            <div className="relative mx-auto w-full max-w-3xl transform-gpu rounded-[34px] p-4 shadow-[0_35px_80px_-50px_rgba(0,0,0,0.65)] transition duration-500 group-hover:-translate-y-4 group-hover:-rotate-1">
              <div className="relative overflow-hidden rounded-[28px] bg-white shadow-[0_20px_40px_-32px_rgba(12,8,25,0.45)]">
                <Image
                  src="/hero-dashboard.svg"
                  alt="Ascend distribution intelligence dashboard"
                  width={640}
                  height={480}
                  className="h-auto w-full"
                  priority
                />
              </div>
            </div>
            <div className="absolute right-6 top-6 hidden w-56 rounded-2xl border border-white/20 bg-white/95 p-4 text-xs text-slate-700 shadow-lg transition duration-500 group-hover:-translate-y-6 group-hover:translate-x-4 group-hover:rotate-[4deg] sm:block">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Live outlet signal
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                North India
              </p>
              <p className="mt-1 text-xs text-slate-500">
                34% lift in secondary sales
              </p>
              <div className="mt-3 rounded-full bg-accent px-3 py-2 text-center text-[11px] font-semibold text-white">
                View playbook
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
