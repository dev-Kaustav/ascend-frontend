const differentiators = [
  {
    title: "Built for fragmented distribution",
    description:
      "A single platform designed for multi-layered distributor ecosystems."
  },
  {
    title: "Offline-first execution",
    description:
      "Ascend mirrors how distributors and sales teams operate on the ground."
  },
  {
    title: "A growing data moat",
    description:
      "Every order improves forecasting and strengthens your network edge."
  },
  {
    title: "Execution plus insights",
    description:
      "Not just a dashboard, but a partner that drives distribution outcomes."
  }
];

export default function WhyAscend() {
  return (
    <section
      id="why-ascend"
      className="border-y border-slate-200/70 bg-white py-16 sm:py-20"
    >
      <div className="mx-auto grid max-w-6xl gap-10 section-pad lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4 reveal-text">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Why Ascend
          </p>
          <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            Built for Indian FMCG realities
          </h2>
          <p className="text-sm text-slate-600 sm:text-base">
            Ascend blends distribution execution with intelligence, tuned to the
            speed, fragmentation, and scale of Indian FMCG markets.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {differentiators.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-700 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-card"
            >
              <div className="reveal-text space-y-2">
                <h3 className="text-base font-semibold text-slate-900">
                  {item.title}
                </h3>
                <p className="text-sm">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
