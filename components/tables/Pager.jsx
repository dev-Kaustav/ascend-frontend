"use client";

// Numbered pages under a list: "1–25 of 4,267 shops", Previous, the first, last and nearby page
// numbers, Next, and a jump to any page. Hidden when everything fits on one page.
export default function Pager({ page, pageSize, total, noun, onChange }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const firstRow = (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);
  const numbers = Array.from({ length: pageCount }, (_, index) => index + 1)
    .filter((number) => number === 1 || number === pageCount || Math.abs(number - page) <= 2);
  const go = (number) => onChange(Math.min(pageCount, Math.max(1, number)));
  return (
    <nav aria-label={`${noun} pages`} className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
      <span className="text-sm tabular-nums text-muted">{firstRow}–{lastRow} of {total} {noun}</span>
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" onClick={() => go(page - 1)} disabled={page === 1} className="min-h-10 rounded-md border border-control bg-white px-3 text-sm hover:border-ink disabled:opacity-40">Previous</button>
        {numbers.map((number, index) => (
          <span key={number} className="inline-flex items-center gap-1">
            {index > 0 && number - numbers[index - 1] > 1 ? <span className="px-1 text-muted">…</span> : null}
            <button type="button" aria-label={`Page ${number}`} aria-current={number === page ? "page" : undefined} onClick={() => go(number)} className={`min-h-10 min-w-10 rounded-md border px-2 text-sm tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${number === page ? "border-ink bg-ink font-semibold text-white" : "border-control bg-white text-ink hover:border-ink hover:bg-raised"}`}>{number}</button>
          </span>
        ))}
        <button type="button" onClick={() => go(page + 1)} disabled={page === pageCount} className="min-h-10 rounded-md border border-control bg-white px-3 text-sm hover:border-ink disabled:opacity-40">Next</button>
        <label className="ml-2 hidden items-center gap-2 text-sm text-muted sm:flex">Go to page
          <select aria-label="Go to page" value={page} onChange={(event) => go(Number(event.target.value))} className="h-10 rounded-md border border-control bg-white pl-3 tabular-nums text-ink">
            {Array.from({ length: pageCount }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
          </select>
        </label>
      </div>
    </nav>
  );
}
