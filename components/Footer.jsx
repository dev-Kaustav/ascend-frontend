export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex flex-col gap-4 py-8 section-pad sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Ascend Foods Pvt Ltd
          </p>
          <p className="text-xs text-slate-500">
            Data-driven FMCG distribution and GTM intelligence.
          </p>
        </div>
        <div className="flex flex-col gap-2 text-xs text-slate-500 sm:items-end">
          <a
            href="mailto:partnerships@ascendfoods.in"
            className="text-sm font-semibold text-slate-700 hover:text-slate-900"
          >
            partnerships@ascendfoods.in
          </a>
          <div className="flex items-center gap-4">
            <a
              href="https://www.linkedin.com"
              className="transition hover:text-slate-900"
            >
              LinkedIn
            </a>
            <span>&copy; {new Date().getFullYear()} Ascend Foods</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
