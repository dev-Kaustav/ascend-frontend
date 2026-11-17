"use client";

import { useEffect, useMemo, useState } from "react";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { formatCurrency, formatDate, formatCount, formatPercent } from "@/lib/format";
import PeriodSelect, { ALL_TIME, describePeriod, periodQuery } from "@/components/ui/PeriodSelect";
import SectionCard from "@/components/layout/SectionCard";
import { PeriodColumns } from "@/components/charts/LedgerCharts";
import DataTable from "@/components/tables/DataTable";

export default function AdminRetailCoverage() {
  const [coverage, setCoverage] = useState(null);
  const [period, setPeriod] = useState(ALL_TIME);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    apiFetch(`${apiEndpoints.dashboard.coverage}?${periodQuery(period)}`)
      .then((data) => { if (active) { setCoverage(data); setError(""); } })
      .catch((err) => { if (active) setError(err.message || "Couldn't load coverage."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [period, retry]);

  const columns = useMemo(() => [
    { header: "Shop", accessorKey: "name" },
    { header: "Orders", accessorKey: "orders", meta: { type: "number" }, cell: ({ row }) => formatCount(row.original.orders) },
    { header: "Order value", accessorKey: "total", meta: { type: "number" }, cell: ({ row }) => formatCurrency(row.original.total) },
    { header: "Last ordered", accessorKey: "last_billed", cell: ({ row }) => formatDate(row.original.last_billed) },
  ], []);
  return (
    <div className="space-y-5 max-lg:px-[2px] [&_.text-sm]:text-[14px] [&_.text-xs]:text-[12px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Shop activity · {describePeriod(period)}</p>
        <PeriodSelect value={period} onChange={(value) => { setLoading(true); setPeriod(value); }} />
      </div>
      {error ? <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}<button type="button" className="font-semibold underline" onClick={() => { setLoading(true); setRetry((v) => v + 1); }}>Retry</button></div> : null}
      <SectionCard title="Beat coverage" subtitle="Shops with orders as a share of shops assigned to a beat.">
        {loading && !coverage ? <p className="text-sm text-muted">Loading coverage…</p> : coverage?.planned === 0 ? (
          <p className="text-sm text-muted">No shops are assigned to a beat yet. {formatCount(coverage.retailers_without_beat)} shops are not on a beat.</p>
        ) : (
          <dl className="grid grid-cols-3 divide-x divide-line">
            {[["Shops on a beat", formatCount(coverage?.planned)], ["With orders", formatCount(coverage?.billed)], ["Coverage", formatPercent(coverage?.coverage_percent)]].map(([label, value]) => (
              <div key={label} className="px-3 first:pl-0"><dt className="text-sm text-muted">{label}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value}</dd></div>
            ))}
          </dl>
        )}
      </SectionCard>
      <SectionCard title="Shops ordering each month" subtitle={describePeriod(period)}><PeriodColumns data={coverage?.activity?.monthly || []} dataKey="value" format={formatCount} height={180} /></SectionCard>
      <SectionCard title="Shop activity" subtitle={`${formatCount(coverage?.activity?.retailers?.length || 0)} shops with orders · ${describePeriod(period)}`}>
        <DataTable mobileCardClassName="!rounded-lg !shadow-none [&_dt]:!text-muted [&_dt]:!normal-case [&_dt]:!tracking-normal" columns={columns} data={coverage?.activity?.retailers || []} emptyLabel={loading ? "Loading shop activity…" : "No shops placed orders in this period."} />
      </SectionCard>
    </div>
  );
}
