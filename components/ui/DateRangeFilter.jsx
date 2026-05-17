"use client";

import { useCallback, useState } from "react";

function toISO(d) {
  return d.toISOString().slice(0, 10);
}

function getPresetRange(key) {
  const now = new Date();
  const today = toISO(now);
  switch (key) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: toISO(y), to: toISO(y) };
    }
    case "last7": {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      return { from: toISO(d), to: today };
    }
    case "mtd": {
      return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`, to: today };
    }
    case "last30": {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      return { from: toISO(d), to: today };
    }
    case "last90": {
      const d = new Date(now);
      d.setDate(d.getDate() - 89);
      return { from: toISO(d), to: today };
    }
    default:
      return null;
  }
}

const PRESETS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7 Days" },
  { key: "mtd", label: "MTD" },
  { key: "last30", label: "Last 30 Days" },
  { key: "last90", label: "Last 90 Days" },
];

export default function DateRangeFilter({ from = "", to = "", onChange, className = "" }) {
  const [active, setActive] = useState(null);
  const [asOfDate, setAsOfDate] = useState("");

  const handlePill = useCallback((key) => {
    if (active === key) {
      setActive(null);
      onChange({ from: "", to: "" });
    } else {
      setActive(key);
      if (key === "asof") {
        const d = asOfDate || toISO(new Date());
        if (!asOfDate) setAsOfDate(d);
        onChange({ from: "", to: d });
      } else {
        const r = getPresetRange(key);
        if (r) onChange(r);
      }
    }
  }, [active, asOfDate, onChange]);

  const handleAsOfChange = useCallback((e) => {
    const d = e.target.value;
    setAsOfDate(d);
    if (d) onChange({ from: "", to: d });
  }, [onChange]);

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => handlePill(p.key)}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
              active === p.key
                ? "bg-[#1a1b2e] text-white shadow-sm"
                : "text-slate-500 hover:bg-white hover:text-slate-700"
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => handlePill("asof")}
          className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
            active === "asof"
              ? "bg-[#1a1b2e] text-white shadow-sm"
              : "text-slate-500 hover:bg-white hover:text-slate-700"
          }`}
        >
          As of
        </button>
      </div>

      {active === "asof" && (
        <input
          type="date"
          value={asOfDate}
          onChange={handleAsOfChange}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none cursor-pointer"
        />
      )}
    </div>
  );
}
