// Two or three views of one thing, switched in place: the app screens' segmented control.
// `tabs` is [[key, label], ...]; the caller owns which one is chosen (often the URL).
export default function SegmentedTabs({ label, tabs, value, onChange }) {
  return (
    <div role="tablist" aria-label={label} className="grid gap-1 rounded-2xl bg-slate-100 p-1" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
      {tabs.map(([key, text]) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={value === key}
          onClick={() => onChange(key)}
          className={`h-10 cursor-pointer rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${value === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
