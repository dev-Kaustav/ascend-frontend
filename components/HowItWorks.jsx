const steps = [
  {
    title: "Integrate distributors and salesmen",
    description:
      "Ascend connects with local distributor teams to digitize daily ordering.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <circle cx="7" cy="12" r="4" />
        <circle cx="17" cy="12" r="4" />
        <path d="M11 12h2" />
      </svg>
    )
  },
  {
    title: "Capture retail orders digitally",
    description:
      "Orders are logged on mobile at the outlet, creating clean primary data.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <rect x="7" y="2" width="10" height="20" rx="2" />
        <path d="M10 18h4" />
      </svg>
    )
  },
  {
    title: "Aggregate data across markets",
    description:
      "Sales and outlet data roll up into a unified, real-time layer.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    )
  },
  {
    title: "Deliver GTM insights",
    description:
      "Brands receive playbooks, coverage gaps, and smart expansion cues.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path d="M3 17l6-6 4 4 7-7" />
        <path d="M14 8h7v7" />
      </svg>
    )
  }
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-[color:var(--color-bg)] py-16 sm:py-20">
      <div className="mx-auto max-w-6xl section-pad">
        <div className="flex flex-col gap-4 reveal-text">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            How It Works
          </p>
          <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            A distribution flow built for scale
          </h2>
          <p className="max-w-2xl text-sm text-slate-600 sm:text-base">
            Inspired by proven FMCG distribution models, Ascend creates a single
            data spine from first order to GTM insight.
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-700 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-card"
            >
              <div className="reveal-text space-y-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                    {step.icon}
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Step {index + 1}
                    </p>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {step.title}
                    </h3>
                  </div>
                </div>
                <p className="text-sm sm:text-base">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
