"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { formatCompactCurrency, formatCount, formatCurrency } from "@/lib/format";
import { PAYMENT_LABEL } from "@/lib/orderStatus";
import { PeriodColumns, ThinRing } from "@/components/charts/LedgerCharts";
import PeriodSelect, { ALL_TIME, describePeriod, periodQuery } from "@/components/ui/PeriodSelect";

// The admin's home. One question: "what needs doing today, and is money coming in?" The work
// waiting on the office comes first, then the money (sales, collections, what shops owe), then the
// day's sales and the stock. Every figure comes from the server (app/services/metrics.py); this
// screen adds nothing up. Sales, collected, orders and sales days follow the period; what shops
// owe, the queues and stock are as of now.

const WAITING = [
  { key: "PENDING", label: "To accept", queue: "to-accept", note: "Accept to reserve stock" },
  { key: "READY_TO_SHIP", label: "Needs a rider", queue: "needs-rider", note: "Accepted, no rider yet" },
  { key: "OUT_FOR_DELIVERY", label: "Out for delivery", queue: "on-the-road", note: "With a rider now" },
  { key: "PAYMENT_DUE", label: "Payment due", queue: "payment-due", note: "Orders with a balance" },
];

const MONEY_TABS = [
  { key: "sales", label: "Invoiced sales", format: formatCurrency, axis: formatCompactCurrency, note: "Invoiced value, by invoice date" },
  { key: "collected", label: "Collected", format: formatCurrency, axis: formatCompactCurrency, note: "Payments received, by collection date" },
  { key: "orders", label: "Orders", format: formatCount, axis: formatCount, note: "Orders placed, cancelled ones left out" },
];


const PAYMENT_COLORS = { PAID: "#2e7d32", PARTIAL: "#c08a2b", CREDIT: "#a3a3a3", UNPAID: "#d4d4d4" };

function fetchDashboard(period) {
  const query = periodQuery(period).toString();
  const withPeriod = (url) => (query ? `${url}?${query}` : url);
  return Promise.allSettled([
    apiFetch(withPeriod(apiEndpoints.admin.summary)),
    apiFetch(apiEndpoints.admin.orderStatusSummary),
    apiFetch(apiEndpoints.admin.outstandingSummary),
    apiFetch(withPeriod(apiEndpoints.admin.dailySales)),
  ]);
}

function Panel({ title, aside, children, className = "" }) {
  return (
    <section className={`flex flex-col rounded-lg border border-line bg-white p-5 ${className}`}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function ViewAll({ href, children }) {
  return (
    <Link href={href} className="text-sm font-medium text-ink hover:underline">
      {children}
    </Link>
  );
}

// "+12% vs ₹40,000 in the 30 days before". Higher is better for all three money figures, so a
// fall is the bad colour.
function Change({ now, before, format, period }) {
  if (!before) {
    return <span className="text-muted">{now ? `Nothing in ${period}` : `Nothing, nor in ${period}`}</span>;
  }
  const pct = ((now - before) / before) * 100;
  const tone = pct > 0.5 ? "text-[#247b50]" : pct < -0.5 ? "text-[#c4242a]" : "text-muted";
  const sign = pct > 0 ? "+" : "";
  return (
    <span className="text-muted">
      <span className={`font-medium tabular-nums ${tone}`}>{`${sign}${pct.toFixed(0)}%`}</span> vs {format(before)} in {period}
    </span>
  );
}

export default function AdminDashboard() {
  const [summary, setSummary] = useState(null);
  const [queues, setQueues] = useState(null);
  const [owed, setOwed] = useState(null);
  const [dailySales, setDailySales] = useState(null);
  const [error, setError] = useState("");
  const [moneyTab, setMoneyTab] = useState("sales");
  const [period, setPeriod] = useState(ALL_TIME);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [refreshing, setRefreshing] = useState(true);
  const [showCalculation, setShowCalculation] = useState(false);

  function apply([s, q, o, d]) {
    if (s.status === "fulfilled") setSummary(s.value);
    if (q.status === "fulfilled") setQueues(q.value || {});
    if (o.status === "fulfilled") setOwed(o.value);
    if (d.status === "fulfilled") setDailySales(d.value);
    const failed = [s, q, o, d].filter((r) => r.status === "rejected").length;
    setError(failed ? `Couldn't load ${failed === 4 ? "the dashboard" : "part of the dashboard"}. Figures shown may be incomplete.` : "");
    setUpdatedAt(dayjs());
    setRefreshing(false);
  }

  function load(nextPeriod) {
    setRefreshing(true);
    fetchDashboard(nextPeriod).then(apply);
  }

  function changePeriod(nextPeriod) {
    setPeriod(nextPeriod);
    // A custom range waits until both ends are set.
    if (nextPeriod.key !== "custom" || (nextPeriod.from && nextPeriod.to)) load(nextPeriod);
  }

  useEffect(() => {
    let active = true;
    fetchDashboard(ALL_TIME).then((results) => {
      if (active) apply(results);
    });
    return () => {
      active = false;
    };
  }, []);

  const money = summary?.money;
  const tab = MONEY_TABS.find((t) => t.key === moneyTab);
  const periodLabel = describePeriod(period);
  const span = money ? dayjs(money.to).diff(dayjs(money.from), "day") + 1 : 0;
  const previousLabel = `the ${span} ${span === 1 ? "day" : "days"} before`;
  const perMonth = money?.bucket === "month";
  const buckets = (money?.buckets || []).map((b) => ({ ...b, label: dayjs(b.start).format(perMonth ? "MMM YYYY" : "D MMM") }));

  const owedShops = owed?.by_retailer?.filter((r) => r.pending > 0) || [];

  const paymentCounts = summary?.orders?.payment_status || {};
  const paymentParts = ["PAID", "PARTIAL", "CREDIT", "UNPAID"]
    .filter((key) => paymentCounts[key])
    .map((key) => ({ key, label: PAYMENT_LABEL[key], value: paymentCounts[key], color: PAYMENT_COLORS[key] }));
  const paymentTotal = summary?.orders?.total || 0;

  const salesDays = (dailySales?.days || []).slice(0, 4);
  const stock = summary?.inventory;


  return (
    <div className="space-y-6 [&_.text-sm]:text-[14px] [&_.text-xs]:text-[12px]">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink">Dashboard</h1>

        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
          {updatedAt ? <span>Updated {updatedAt.format("HH:mm")}</span> : null}
          <PeriodSelect value={period} onChange={changePeriod} />
          <button
            type="button"
            onClick={() => load(period)}
            disabled={refreshing}
            className="h-9 rounded-md border border-control bg-white px-3 font-medium text-ink hover:bg-raised disabled:opacity-60"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {error ? <p className="rounded-lg border border-[#fde68a] bg-[#fffbeb] px-4 py-2.5 text-sm text-[#92400e]">{error}</p> : null}

      <nav aria-label="Orders waiting" className="flex flex-wrap gap-2">
        {WAITING.map((item) => {
          const count = queues ? queues[item.key] || 0 : null;
          const attention = item.key === "PENDING" || item.key === "READY_TO_SHIP";
          return (
            <Link key={item.key} href={`/app/orders?queue=${item.queue}`} className={`inline-flex min-h-[44px] items-center gap-3 rounded-md border px-4 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${attention && count ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100" : "border-control bg-white text-ink hover:border-ink hover:bg-raised"}`}>
              {item.label}<span className="tabular-nums">{count === null ? "…" : count}</span>
            </Link>
          );
        })}
      </nav>

      <section aria-label="Outstanding balances" className="rounded-lg border border-line bg-white">
        <div className="flex flex-col divide-line sm:flex-row sm:flex-wrap sm:divide-x">
          <div className="flex-1 p-5 sm:min-w-[180px]">
            <h2 className="text-sm font-medium text-muted">Total outstanding</h2>
            <p className="mt-2 text-[30px] font-semibold leading-tight tabular-nums text-ink">{owed ? formatCurrency(owed.total_outstanding) : "…"}</p>
            <p className="mt-2 text-xs text-muted">As of today · {owedShops.length} shops</p>
          </div>
          {(owed?.breakdown || [{ key: "dispatched", label: "Delivered / out for delivery" }, { key: "pending", label: "Pending orders" }]).map((part) => (
            <div key={part.key} className="flex-1 border-t p-5 sm:min-w-[180px] sm:border-t-0">
              <h3 className="text-sm font-medium text-muted">{part.label}</h3>
              <p className="mt-2 text-[24px] font-semibold leading-tight tabular-nums text-ink">{owed ? formatCurrency(part.amount) : "…"}</p>
              <p className="mt-2 text-xs text-muted">{part.orders === undefined ? "…" : `${part.orders} orders with a balance`}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
          <button type="button" aria-expanded={showCalculation} onClick={() => setShowCalculation((open) => !open)} className="text-sm font-medium text-ink underline decoration-control underline-offset-4 hover:decoration-ink">{showCalculation ? "Hide calculation" : "How it’s calculated"}</button>
          <ViewAll href="/app/retailers?tab=outstanding">View outstanding orders →</ViewAll>
        </div>
        {showCalculation && owed?.reconciliation ? (
          <dl className="space-y-2 border-t border-line bg-surface-soft px-5 py-4 text-sm">
            {[["Order value · all time", owed.reconciliation.order_value], ["Collected against these orders", owed.reconciliation.collected], ...(owed.reconciliation.credits > 0 ? [["Credits applied", owed.reconciliation.credits]] : []), ...(owed.reconciliation.excess_payments > 0 ? [["Excess payments on settled orders", owed.reconciliation.excess_payments]] : [])].map(([label, amount]) => <div key={label} className="flex items-baseline justify-between gap-4"><dt className="text-muted">{label}</dt><dd className="tabular-nums text-ink">{formatCurrency(amount)}</dd></div>)}
          </dl>
        ) : null}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Money coming in: the period's totals as tabs over the same figure per week or month. */}
        <section className="min-w-0 rounded-lg border border-line bg-white lg:col-span-2">
          <div role="tablist" aria-label="Money" className="grid grid-cols-1 border-b border-line sm:grid-cols-3">
            {MONEY_TABS.map((t) => {
              const selected = t.key === moneyTab;
              const now = money?.totals?.[t.key] || 0;
              const before = money?.previous?.[t.key] || 0;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setMoneyTab(t.key)}
                  className={`-mb-px border-b-2 px-5 py-4 text-left transition-colors max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:items-center max-sm:gap-x-3 ${selected ? "border-ink" : "border-transparent hover:bg-surface-soft"}`}
                >
                  <span className={`block text-[13px] ${selected ? "text-ink" : "text-muted"}`}>{t.label}, {periodLabel.toLowerCase()}</span>
                  <span className={`mt-0.5 block text-2xl tabular-nums text-ink max-sm:mt-0 max-sm:text-[20px] ${selected ? "font-bold" : "font-normal"}`}>
                    {money ? t.format(now) : "–"}
                  </span>
                  {money?.previous ? <span className="mt-0.5 block text-xs max-sm:col-span-2"><Change now={now} before={before} format={t.format} period={previousLabel} /></span> : null}
                </button>
              );
            })}
          </div>
          <div className="px-5 pb-4 pt-3">
            <div className="mb-1 flex items-baseline justify-between gap-3 text-xs text-muted">
              <span>{tab.note}, per {perMonth ? "month" : "week"}</span>
              <span>Latest {perMonth ? "month" : "week"} in maroon</span>
            </div>
            {money ? (
              <PeriodColumns
                height={200}
                data={buckets}
                dataKey={moneyTab}
                format={tab.format}
                axisFormat={tab.axis}
                labelFormat={(label) => (perMonth ? label : `Week of ${label}`)}
              />
            ) : (
              <div className="h-[220px]" />
            )}
          </div>
        </section>

        <Panel title="Stock" aside={<ViewAll href="/app/operations">View inventory</ViewAll>}>
          <p className="text-[13px] text-muted">Value on hand, at landing price</p>
          <p className="text-[28px] font-bold leading-tight tabular-nums text-ink">
            {stock ? (stock.inventory_value === null ? "—" : formatCurrency(stock.inventory_value)) : "–"}
          </p>
          {stock?.unpriced_skus ? (
            <p className="text-xs text-muted">{stock.unpriced_skus} SKUs have no landing price and are not counted.</p>
          ) : null}
          <p className="mb-1.5 mt-4 text-xs text-muted">Fewest units left</p>
          <ul className="space-y-1.5 text-sm">
            {(stock?.lowest || []).map((row) => (
              <li key={row.sku_id} className="flex items-baseline justify-between gap-3">
                <span className="truncate text-ink" title={row.code || row.name}>{row.name}</span>
                <span className={`shrink-0 tabular-nums ${row.units ? "text-ink" : "font-medium text-data"}`}>
                  {row.units ? `${formatCount(row.units)} units` : "Out of stock"}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Orders by payment" aside={<span className="text-xs text-muted">{periodLabel}</span>}>
          <div className="flex items-center gap-5">
            <ThinRing parts={paymentParts} />
            <table className="w-full text-sm">
              <tbody>
                {paymentParts.map((part) => (
                  <tr key={part.key}>
                    <td className="py-1">
                      <span className="mr-2 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: part.color }} />
                      {part.label}
                    </td>
                    <td className="py-1 text-right tabular-nums text-ink">{part.value}</td>
                    <td className="w-12 py-1 text-right tabular-nums text-muted">{Math.round((part.value / paymentTotal) * 100)}%</td>
                  </tr>
                ))}
                {paymentParts.length ? (
                  <tr className="border-t border-rule">
                    <td className="pt-2 text-muted">All orders</td>
                    <td className="pt-2 text-right tabular-nums text-ink">{paymentTotal}</td>
                    <td />
                  </tr>
                ) : null}
                {!paymentParts.length ? (
                  <tr>
                    <td className="py-1 text-muted">No orders yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Recent sales days" aside={<ViewAll href="/app/finance?tab=daily-sales">Daily sales</ViewAll>}>
          {salesDays.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="pb-1.5 text-left font-normal">Day</th>
                  <th className="pb-1.5 text-right font-normal">Orders</th>
                  <th className="pb-1.5 text-right font-normal">Delivered</th>
                  <th className="pb-1.5 text-right font-normal">Amount</th>
                </tr>
              </thead>
              <tbody>
                {salesDays.map((day) => (
                  <tr key={day.date} className="border-t border-rule">
                    <td className="py-2 text-ink">
                      {dayjs(day.date).format("ddd D MMM")}
                      {day.by_salesman?.[0]?.salesman_name ? (
                        <span className="block text-xs text-muted">
                          {day.by_salesman.map((sm) => sm.salesman_name).filter(Boolean).slice(0, 2).join(", ")}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 text-right tabular-nums">{day.total_orders}</td>
                    <td className="py-2 text-right tabular-nums">{day.delivered}</td>
                    <td className="py-2 text-right tabular-nums text-ink">{formatCurrency(day.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted">{dailySales ? "No sales recorded yet." : "\u00a0"}</p>
          )}
        </Panel>


      </div>
    </div>
  );
}
