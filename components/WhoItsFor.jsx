const audiences = [
  {
    title: "FMCG Brands",
    bullets: [
      "Faster expansion into under-served markets",
      "Visibility into SKU and outlet performance",
      "Smart GTM playbooks for sales teams"
    ]
  },
  {
    title: "Distributors and Sales Networks",
    bullets: [
      "Digitized orders with less manual effort",
      "Shared planning with brand partners",
      "Better inventory and beat optimization"
    ]
  }
];

export default function WhoItsFor() {
  return (
    <section id="who-its-for" className="bg-[color:var(--color-bg)] py-16 sm:py-20">
      <div className="mx-auto max-w-6xl section-pad">
        <div className="flex flex-col gap-4 reveal-text">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Who It&apos;s For
          </p>
          <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            Teams that need distribution certainty
          </h2>
          <p className="max-w-2xl text-sm text-slate-600 sm:text-base">
            Ascend serves both sides of the distribution equation with tools and
            intelligence that scale together.
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {audiences.map((audience) => (
            <div
              key={audience.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-700 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-card"
            >
              <div className="reveal-text">
                <h3 className="text-lg font-semibold text-slate-900">
                  {audience.title}
                </h3>
                <ul className="mt-4 space-y-3 text-sm sm:text-base">
                  {audience.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-3">
                      <span className="mt-2 h-2 w-2 rounded-full bg-accent" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
