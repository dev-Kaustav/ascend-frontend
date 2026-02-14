import Image from "next/image";

const founders = [
  {
    name: "Pranshu Birla",
    role: "Founder & CEO",
    image: "/pranshu.jpg",
    accent: "sky",
    linkedin: "https://www.linkedin.com/in/pranshubirlapb/",
    overview: [
      "Pranshu Birla is the Founder & CEO of Ascend, leading offline GTM execution and city expansion. He previously worked at Wherehouse, where he built structured sales, logistics, and credit frameworks across multiple FMCG brands. He specialises in transforming fragmented distribution networks into disciplined, process-driven operating systems.",
      "Prior to that, he worked at Samagra Governance on large-scale public sector transformation initiatives, contributing to digital system implementation and operational reforms at scale."
    ]
  },
  {
    name: "Kaustav Mukherjee",
    role: "Founder & CTO",
    image: "/kaustav.jpg",
    accent: "violet",
    linkedin: "https://www.linkedin.com/in/mkaustav/",
    overview: [
      "Kaustav Mukherjee is the Founder & CTO of Ascend, leading technology architecture and data systems. He previously worked at ScalarField (YC W25), building financial data infrastructure and analytics systems, and at ION Trading and SoftSolutions, where he engineered low-latency trading platforms used by global investment banks.",
      "With a background in distributed systems, financial reconciliation engines, and high-throughput transaction processing, Kaustav brings fintech-grade reliability and systems thinking to offline distribution."
    ]
  }
];

const accentStyles = {
  sky: {
    bar: "before:bg-sky-500",
    badge: "bg-sky-100 text-sky-700",
    link: "text-sky-700 hover:text-sky-900"
  },
  violet: {
    bar: "before:bg-violet-500",
    badge: "bg-violet-100 text-violet-700",
    link: "text-violet-700 hover:text-violet-900"
  }
};

export default function MeetFounders() {
  return (
    <section
      id="founders"
      className="bg-white py-16 sm:py-20"
    >
      <div className="mx-auto max-w-6xl section-pad">
        <div className="flex flex-col items-center gap-4 text-center reveal-text">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-700">
            Leadership
          </span>
          <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            Built by builders
          </h2>
          <p className="max-w-2xl text-sm text-slate-600 sm:text-base">
            Founders with deep distribution and systems experience, focused on
            helping FMCG brands scale across India.
          </p>
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {founders.map((founder) => {
            const accent = accentStyles[founder.accent];
            return (
              <div
                key={founder.name}
                className={`relative overflow-hidden rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-card before:absolute before:inset-x-0 before:top-0 before:h-1.5 ${accent.bar}`}
              >
                <div className="reveal-text space-y-5">
                  <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 pb-4">
                    <div className="relative h-20 w-20 overflow-hidden rounded-full border-4 border-white shadow">
                      <Image
                        src={founder.image}
                        alt={founder.name}
                        width={160}
                        height={160}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        {founder.name}
                      </h3>
                      <span
                        className={`mt-2 inline-flex rounded-md px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${accent.badge}`}
                      >
                        {founder.role}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-4 text-sm text-slate-600">
                    {founder.overview.map((paragraph, index) => (
                      <p key={`${founder.name}-overview-${index}`}>
                        {paragraph}
                      </p>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500">
                    <a
                      href={founder.linkedin}
                      target="_blank"
                      rel="noreferrer"
                      className={`inline-flex items-center gap-2 font-medium underline-offset-4 transition hover:underline ${accent.link}`}
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="currentColor"
                      >
                        <path d="M4.98 3.5C3.86 3.5 3 4.37 3 5.45c0 1.05.84 1.95 1.94 1.95h.02c1.14 0 1.98-.9 1.98-1.95C6.94 4.37 6.1 3.5 4.98 3.5zM3.5 8.5h2.96V21H3.5V8.5zM9.03 8.5h2.84v1.7h.04c.4-.75 1.37-1.53 2.82-1.53 3.02 0 3.58 1.98 3.58 4.55V21h-2.96v-6.44c0-1.54-.03-3.52-2.14-3.52-2.14 0-2.47 1.67-2.47 3.4V21H9.03V8.5z" />
                      </svg>
                      <span className="sr-only">{founder.name} LinkedIn</span>
                      <span>LinkedIn</span>
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
