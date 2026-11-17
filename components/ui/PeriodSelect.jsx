"use client";

import dayjs from "dayjs";

// The period a screen's flows (sales, collected, orders, stock in and out) are counted over. All
// time is the default everywhere; balances such as what shops owe ignore it. The server does the
// counting: this only turns a choice into from/to dates (empty means no limit).

const PRESETS = [
  { key: "all", label: "All time" },
  { key: "month", label: "This month" },
  { key: "30", label: "Last 30 days" },
  { key: "90", label: "Last 90 days" },
  { key: "custom", label: "Custom range" },
];

export const ALL_TIME = { key: "all", from: "", to: "" };

function rangeFor(key) {
  const today = dayjs();
  const iso = (d) => d.format("YYYY-MM-DD");
  if (key === "month") return { from: iso(today.startOf("month")), to: iso(today) };
  if (key === "30") return { from: iso(today.subtract(29, "day")), to: iso(today) };
  if (key === "90") return { from: iso(today.subtract(89, "day")), to: iso(today) };
  return { from: "", to: "" };
}

export function describePeriod(period) {
  if (!period || period.key === "all") return "All time";
  if (period.key !== "custom") return PRESETS.find((p) => p.key === period.key)?.label;
  const from = period.from ? dayjs(period.from).format("D MMM YYYY") : "the start";
  const to = period.to ? dayjs(period.to).format("D MMM YYYY") : "today";
  return `${from} to ${to}`;
}

export function periodQuery(period) {
  const params = new URLSearchParams();
  if (period?.from) params.set("from_date", period.from);
  if (period?.to) params.set("to_date", period.to);
  return params;
}

const CONTROL = "h-9 rounded-md border border-control bg-white px-2.5 text-sm text-ink focus:border-ink focus:outline-none";

export default function PeriodSelect({ value = ALL_TIME, onChange, label = "Period" }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label={label}
        value={value.key}
        onChange={(event) => {
          const key = event.target.value;
          onChange(key === "custom" ? { key, from: value.from || rangeFor("month").from, to: value.to || rangeFor("month").to } : { key, ...rangeFor(key) });
        }}
        className={CONTROL}
      >
        {PRESETS.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </select>
      {value.key === "custom" ? (
        <>
          <input
            type="date"
            aria-label="From"
            value={value.from}
            max={value.to || undefined}
            onChange={(event) => onChange({ ...value, from: event.target.value })}
            className={CONTROL}
          />
          <span className="text-sm text-muted">to</span>
          <input
            type="date"
            aria-label="To"
            value={value.to}
            min={value.from || undefined}
            onChange={(event) => onChange({ ...value, to: event.target.value })}
            className={CONTROL}
          />
        </>
      ) : null}
    </div>
  );
}
