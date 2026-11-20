"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, MapPin } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import FieldSection from "@/components/field/FieldSection";
import SegmentedTabs from "@/components/field/SegmentedTabs";
import { daysAgo, ShopActions, ShopAvatar } from "@/components/shops/ShopParts";
import { apiEndpoints } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { STATUS_TONE, statusLabel } from "@/lib/orderStatus";
import { can } from "@/lib/policy";
import { queryPath } from "@/lib/query";
import useBackNavigation from "@/lib/hooks/useBackNavigation";

// One shop, as an app screen: who it is with Call / Map / Order, then three tabs: how it buys
// (report), its orders, and what it owes. The same screen for a salesman and the office; every
// figure is the server's (metrics.retailer_report). The tab is in the URL, so coming back from an
// order lands on the tab it was opened from.

const TABS = [
  ["report", "Report"],
  ["orders", "Orders"],
  ["outstanding", "Outstanding"],
];
const ORDERS_PAGE = 20;
const AGING = [
  ["0_7", "0–7 days"],
  ["7_15", "8–15 days"],
  ["15_30", "16–30 days"],
  ["30_plus", "30+ days"],
];

// One order as a row: number and date on the left, amount and status on the right; it opens the
// order. The Orders tab and the unpaid bills both list orders this way.
function OrderRow({ href, title, detail, amount, note, status }) {
  return (
    <li>
      <Link href={href} className="flex min-h-14 items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-slate-50 active:bg-slate-100">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-900">{title}</span>
          <span className="block truncate text-xs text-slate-500">{detail}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-sm font-semibold tabular-nums text-slate-900">{amount}</span>
          {note ? <span className="block text-xs tabular-nums text-slate-400">{note}</span> : null}
        </span>
        {status ? (
          <span className={`hidden w-28 shrink-0 rounded-lg px-2 py-1 text-center text-xs font-semibold sm:block ${STATUS_TONE[status] || "bg-slate-100 text-slate-700"}`}>
            {statusLabel(status)}
          </span>
        ) : null}
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
      </Link>
    </li>
  );
}

function Tile({ label, value, note }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold tabular-nums text-slate-900">{value}</p>
      {note ? <p className="mt-0.5 truncate text-xs text-slate-400">{note}</p> : null}
    </div>
  );
}

function Report({ report }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Tile label="This month" value={formatCurrency(report.this_month)} note={`Last month ${formatCurrency(report.last_month)}`} />
      <Tile label="Owed" value={formatCurrency(report.outstanding)} note={report.unpaid_bills.length ? `${report.unpaid_bills.length} unpaid ${report.unpaid_bills.length === 1 ? "bill" : "bills"}` : "Nothing due"} />
      <Tile label="Orders" value={report.orders} note={report.orders ? `Average ${formatCurrency(report.average_order)}` : "None yet"} />
      <Tile label="Last order" value={report.last_order_at ? formatDate(report.last_order_at) : "—"} note={daysAgo(report.last_order_at)} />
      <Tile label="Ordered in all" value={formatCurrency(report.ordered_value)} />
      <Tile label="Collected" value={formatCurrency(report.collected)} />
    </div>
  );
}

function Orders({ shopId }) {
  const [limit, setLimit] = useState(ORDERS_PAGE);
  const { data, isPending, isPlaceholderData } = useQuery({
    queryKey: queryPath(`${apiEndpoints.orders.list}?retailer_id=${shopId}&limit=${limit}&offset=0`),
    placeholderData: keepPreviousData,
  });
  const orders = data?.items || [];
  if (isPending) return <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Loading orders…</p>;
  if (!orders.length) return <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">No orders yet.</p>;
  return (
    <FieldSection title="Orders" meta={`${data.total} in all · latest first`}>
      <ul className="-mx-2 divide-y divide-slate-100">
        {orders.map((order) => (
          <OrderRow
            key={order.id}
            href={`/app/orders/${order.id}`}
            title={`Order #${order.id}`}
            detail={[formatDate(order.created_at || order.order_date), order.invoice_number].filter(Boolean).join(" · ")}
            amount={formatCurrency(order.total_amount)}
            // Phones have no room for the status column; it goes under the amount there.
            note={<span className="sm:hidden">{statusLabel(order.status)}</span>}
            status={order.status}
          />
        ))}
      </ul>
      {(data?.total || 0) > orders.length ? (
        <button
          type="button"
          disabled={isPlaceholderData}
          onClick={() => setLimit((value) => Math.min(value + ORDERS_PAGE, 200))}
          className="h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 disabled:opacity-60"
        >
          {isPlaceholderData ? "Loading…" : `Show more (${data.total - orders.length} left)`}
        </button>
      ) : null}
    </FieldSection>
  );
}

function Outstanding({ report }) {
  const bills = report.unpaid_bills;
  return (
    <div className="space-y-3">
      <FieldSection title="Owed">
        <p className={`text-2xl font-semibold tabular-nums ${report.outstanding > 0 ? "text-[#5e0b26]" : "text-slate-900"}`}>{formatCurrency(report.outstanding)}</p>
        <div className="grid grid-cols-4 gap-2">
          {AGING.map(([key, label]) => (
            <div key={key} className="min-w-0 rounded-xl bg-slate-50 px-2 py-2 text-center">
              <p className="text-[11px] text-slate-500">{label}</p>
              <p className={`truncate text-xs font-semibold tabular-nums ${key === "30_plus" && report.aging[key] > 0 ? "text-[#5e0b26]" : "text-slate-900"}`}>
                {formatCurrency(report.aging[key])}
              </p>
            </div>
          ))}
        </div>
      </FieldSection>
      <FieldSection title="Unpaid bills" meta={bills.length ? "Oldest first" : null}>
        {bills.length ? (
          <ul className="-mx-2 divide-y divide-slate-100">
            {bills.map((bill) => (
              <OrderRow
                key={bill.order_id}
                href={`/app/orders/${bill.order_id}`}
                title={`Order #${bill.order_id}${bill.invoice_number ? ` · ${bill.invoice_number}` : ""}`}
                detail={`${formatDate(bill.created_at)} · ${bill.days} ${bill.days === 1 ? "day" : "days"} old`}
                amount={formatCurrency(bill.pending)}
                note={bill.pending !== bill.total ? `of ${formatCurrency(bill.total)}` : null}
                status={bill.status}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Nothing owed. Every bill is paid.</p>
        )}
      </FieldSection>
    </div>
  );
}

export default function ShopScreen({ shopId }) {
  const { role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = TABS.some(([key]) => key === searchParams.get("tab")) ? searchParams.get("tab") : "report";
  const { data: shop, error, isPending } = useQuery({ queryKey: queryPath(apiEndpoints.retailers.overview(shopId)), enabled: Boolean(shopId) });
  const goBack = useBackNavigation("/app/retailers");

  if (error) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">{error.message || "Unable to load this shop."}</div>;
  if (isPending) return <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Loading shop…</div>;

  const place = [shop.address_line1, shop.city].filter(Boolean).join(", ");
  const assignment = [can(role, "manageRetailers") ? shop.salesman_name || "No salesman" : null, shop.beat_name].filter(Boolean).join(" · ");
  const chooseTab = (key) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {/* Phones have the back arrow in the app header; the desk has no such header. */}
      <button type="button" onClick={goBack} className="hidden cursor-pointer items-center gap-1.5 text-sm font-medium text-muted hover:text-ink lg:inline-flex">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Retailers
      </button>
      <FieldSection>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <ShopAvatar name={shop.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-slate-900">{shop.name}</p>
            {place ? (
              <p className="flex items-center gap-1 text-sm text-slate-500">
                <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                <span className="truncate">{place}</span>
              </p>
            ) : null}
            {assignment ? <p className="truncate text-xs text-slate-400">{assignment}</p> : null}
          </div>
        </div>
        <div className="sm:w-80 sm:shrink-0">
          <ShopActions shop={shop} canOrder={can(role, "createOrder")} />
        </div>
        </div>
      </FieldSection>

      <SegmentedTabs label="Shop" tabs={TABS} value={tab} onChange={chooseTab} />

      {tab === "report" ? <Report report={shop.report} /> : null}
      {tab === "orders" ? <Orders shopId={shop.id} /> : null}
      {tab === "outstanding" ? <Outstanding report={shop.report} /> : null}
    </div>
  );
}
