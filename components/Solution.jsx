const solutions = [
  {
    title: "Distribution access",
    description:
      "Plug into a curated network of distributors to accelerate market entry."
  },
  {
    title: "Real-time order capture",
    description:
      "Digitize secondary orders at the retailer level to eliminate data lag."
  },
  {
    title: "Outlet-level insights",
    description:
      "Track SKU movement, store potential, and category gaps by micro-market."
  },
  {
    title: "GTM recommendations",
    description:
      "Use proven playbooks for pricing, assortment, and sales execution."
  }
];

export default function Solution() {
  return (
    <section
      id="product"
      className="border-y border-slate-200/70 bg-white py-16 sm:py-20"
    >
      <div className="mx-auto max-w-6xl section-pad">
        <div className="flex flex-col gap-4 reveal-text">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Solution
          </p>
          <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            One platform for distribution and intelligence
          </h2>
          <p className="max-w-2xl text-sm text-slate-600 sm:text-base">
            Ascend combines execution with intelligence so brands can expand
            faster without losing control of their GTM strategy.
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {solutions.map((solution, index) => (
            <div
              key={solution.title}
              className="group rounded-2xl border border-slate-200 bg-white p-6 text-slate-700 shadow-sm transition hover:-translate-y-1 hover:shadow-card"
            >
              <div className="reveal-text space-y-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-sm font-semibold text-accent">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {solution.title}
                  </h3>
                </div>
                <p className="text-sm sm:text-base">{solution.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
