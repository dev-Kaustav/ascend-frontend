const problems = [
  "Brands lack visibility into secondary sales.",
  "Distributor data is fragmented and delayed.",
  "GTM decisions are still intuition-driven.",
  "Scaling beyond metros stays inefficient."
];

export default function Problem() {
  return (
    <section id="problem" className="bg-[color:var(--color-bg)] py-16 sm:py-20">
      <div className="mx-auto grid max-w-6xl gap-10 section-pad lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4 reveal-text">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            The Challenge
          </p>
          <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            The FMCG distribution blind spot
          </h2>
          <p className="text-sm text-slate-600 sm:text-base">
            Distribution is the growth engine for FMCG, but brands rarely see
            what happens after the first sale. Ascend makes the invisible
            visible.
          </p>
        </div>
        <ul className="grid gap-4">
          {problems.map((problem) => (
            <li
              key={problem}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-700 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-card"
            >
              <div className="reveal-text flex gap-3">
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" />
                <p className="text-sm sm:text-base">{problem}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
