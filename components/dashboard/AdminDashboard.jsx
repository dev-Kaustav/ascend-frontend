"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { formatCompactCurrency, formatCount, formatCurrency } from "@/lib/format";
import { PAYMENT_LABEL } from "@/lib/orderStatus";
import { PeriodColumns, ThinRing } from "@/components/charts/LedgerCharts";

// The admin's home. One question: "what needs doing today, and is money coming in?" The work
// waiting on the office comes first, then the money (sales, collections, what shops owe), then the
// day's sales and the stock. Every figure comes from the server; nothing here is a placeholder.

const WAITING = [
  { key: "PENDING", label: "To accept", queue: "to-accept", note: "Accept to reserve stock" },
  { key: "READY_TO_SHIP", label: "Needs a rider", queue: "needs-rider", note: "Accepted, no rider yet" },
  { key: "OUT_FOR_DELIVERY", label: "Out for delivery", queue: "on-the-road", note: "With a rider now" },
  { key: "PAYMENT_DUE", label: "Payment due", queue: "payment-due", note: "Delivered, not fully paid" },
];

const MONEY_TABS = [
  { key: "sales", label: "Sales", format: formatCurrency, axis: formatCompactCurrency, note: "Invoiced value, by invoice date" },
  { key: "collected", label: "Collected", format: formatCurrency, axis: formatCompactCurrency, note: "Payments received, by collection date" },
  { key: "orders", label: "Orders", format: formatCount, axis: formatCount, note: "Orders placed, cancelled ones left out" },
];

const AGING = [
  { key: "0_7", label: "Up to 7 days" },
  { key: "7_15", label: "8 to 15 days" },
  { key: "15_30", label: "16 to 30 days" },
  { key: "30_plus", label: "Over 30 days", risk: true },
];

const PAYMENT_COLORS = { PAID: "#2e7d32", PARTIAL: "#c08a2b", CREDIT: "#a3a3a3", UNPAID: "#d4d4d4" };

function fetchDashboard() {
  return Promise.allSettled([
    apiFetch(apiEndpoints.admin.summary),
    apiFetch(apiEndpoints.admin.orderStatusSummary),
    apiFetch(apiEndpoints.admin.outstandingSummary),
    apiFetch(apiEndpoints.admin.dailySales),
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

// "+12% vs 1–17 Oct". Higher is better for all three money figures, so a fall is the bad colour.
function Change({ now, before, format, period }) {
  if (!before) {
    return <span className="text-muted">{now ? `${format(now)} new against ${period}` : `Nothing yet, nor in ${period}`}</span>;
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
  const [updatedAt, setUpdatedAt] = useState(null);
  const [refreshing, setRefreshing] = useState(true);

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

  function refresh() {
    setRefreshing(true);
    fetchDashboard().then(apply);
  }

  useEffect(() => {
    let active = true;
    fetchDashboard().then((results) => {
      if (active) apply(results);
    });
    return () => {
      active = false;
    };
  }, []);

  const money = summary?.money;
  const tab = MONEY_TABS.find((t) => t.key === moneyTab);
  const today = money ? dayjs(money.today) : dayjs();
  const thisPeriod = `1–${today.date()} ${today.format("MMM")}`;
  const lastPeriodEnd = Math.min(today.date(), today.subtract(1, "month").daysInMonth());
  const lastPeriod = `1–${lastPeriodEnd} ${today.subtract(1, "month").format("MMM")}`;
  const weeks = (money?.weeks || []).map((w) => ({ ...w, label: dayjs(w.week_start).format("D MMM") }));

  const owedShops = owed?.by_retailer?.filter((r) => r.pending > 0) || [];
  const agingMax = Math.max(1, ...AGING.map((a) => owed?.aging?.[a.key] || 0));

  const paymentCounts = summary?.orders?.payment_status || {};
  const paymentParts = ["PAID", "PARTIAL", "CREDIT", "UNPAID"]
    .filter((key) => paymentCounts[key])
    .map((key) => ({ key, label: PAYMENT_LABEL[key], value: paymentCounts[key], color: PAYMENT_COLORS[key] }));
  const paymentTotal = paymentParts.reduce((sum, p) => sum + p.value, 0);

  const salesDays = (dailySales?.days || []).slice(0, 4);
  const stock = summary?.inventory;

  const waitingCount = (queues?.PENDING || 0) + (queues?.READY_TO_SHIP || 0);
  const finding = owed
    ? `${formatCurrency(owed.total_outstanding || 0)} owed by ${owedShops.length} ${owedShops.length === 1 ? "shop" : "shops"}${
        waitingCount ? `; ${waitingCount} ${waitingCount === 1 ? "order is" : "orders are"} waiting on the office.` : "."
      }`
    : "Loading today's figures…";

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">{finding}</p>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted">
          {updatedAt ? <span>Updated {updatedAt.format("HH:mm")}</span> : null}
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="h-9 rounded-md border border-control bg-white px-3 font-medium text-ink hover:bg-raised disabled:opacity-60"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {error ? <p className="rounded-lg border border-[#fde68a] bg-[#fffbeb] px-4 py-2.5 text-sm text-[#92400e]">{error}</p> : null}

      {/* Waiting on the office: each cell opens that queue on the orders screen. */}
      <nav aria-label="Orders waiting" className="grid grid-cols-2 divide-line rounded-lg border border-line bg-white lg:grid-cols-4 lg:divide-x">
        {WAITING.map((item) => {
          const count = queues ? queues[item.key] || 0 : null;
          return (
            <Link
              key={item.key}
              href={`/app/orders?queue=${item.queue}`}
              className="group px-5 py-4 transition-colors first:rounded-l-lg last:rounded-r-lg hover:bg-surface-soft"
            >
              <span className="block text-[13px] text-muted group-hover:text-ink">{item.label}</span>
              <span className={`mt-0.5 block text-2xl font-semibold tabular-nums ${count ? "text-ink" : "text-muted"}`}>
                {count === null ? "–" : count}
              </span>
              <span className="block text-xs text-muted">
                {item.key === "PAYMENT_DUE" && owed ? `${formatCurrency(owed.total_outstanding || 0)} to collect` : item.note}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Money coming in: the month so far as tabs over twelve weeks of the same figure. */}
        <section className="rounded-lg border border-line bg-white lg:col-span-2">
          <div role="tablist" aria-label="Money" className="grid grid-cols-3 border-b border-line">
            {MONEY_TABS.map((t) => {
              const selected = t.key === moneyTab;
              const now = money?.month_to_date?.[t.key] || 0;
              const before = money?.previous_month_to_date?.[t.key] || 0;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setMoneyTab(t.key)}
                  className={`-mb-px border-b-2 px-5 py-4 text-left transition-colors ${selected ? "border-ink" : "border-transparent hover:bg-surface-soft"}`}
                >
                  <span className={`block text-[13px] ${selected ? "text-ink" : "text-muted"}`}>{t.label}, {thisPeriod}</span>
                  <span className={`mt-0.5 block text-2xl tabular-nums text-ink ${selected ? "font-bold" : "font-normal"}`}>
                    {money ? t.format(now) : "–"}
                  </span>
                  <span className="mt-0.5 block text-xs">
                    {money ? <Change now={now} before={before} format={t.format} period={lastPeriod} /> : " "}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="px-5 pb-4 pt-3">
            <div className="mb-1 flex items-baseline justify-between gap-3 text-xs text-muted">
              <span>{tab.note}, per week, last 12 weeks</span>
              <span>This week in maroon</span>
            </div>
            {money ? (
              <PeriodColumns
                data={weeks}
                dataKey={moneyTab}
                format={tab.format}
                axisFormat={tab.axis}
                labelFormat={(label) => `Week of ${label}`}
              />
            ) : (
              <div className="h-[220px]" />
            )}
          </div>
        </section>

        <Panel title="Owed by shops" aside={<ViewAll href="/app/retailers?tab=outstanding">View all</ViewAll>}>
          <p className="text-[28px] font-bold leading-tight tabular-nums text-ink">{owed ? formatCurrency(owed.total_outstanding || 0) : "–"}</p>
          <p className="text-xs text-muted">
            {owed ? `${owedShops.length} ${owedShops.length === 1 ? "shop" : "shops"}, delivered orders not fully paid` : " "}
          </p>
          <ul className="mt-4 space-y-2.5">
            {AGING.map((a) => {
              const amount = owed?.aging?.[a.key] || 0;
              return (
                <li key={a.key}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-muted">{a.label}</span>
                    <span className={`tabular-nums ${a.risk && amount ? "font-medium text-data" : amount ? "text-ink" : "text-muted"}`}>
                      {formatCurrency(amount)}
                    </span>
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-raised">
                    <div
                      className={`h-1 rounded-full ${a.risk ? "bg-data" : "bg-ink"}`}
                      style={{ width: `${(amount / agingMax) * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          {owedShops.length ? (
            <div className="mt-4 border-t border-line pt-3">
              <p className="mb-1.5 text-xs text-muted">Owing the most</p>
              <ul className="space-y-1.5 text-sm">
                {owedShops.slice(0, 3).map((shop) => (
                  <li key={shop.retailer_id} className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-ink">{shop.retailer_name}</span>
                    <span className="shrink-0 tabular-nums text-ink">{formatCurrency(shop.pending)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Orders by payment" aside={<span className="text-xs text-muted">All time</span>}>
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
    </div>
  );
}
