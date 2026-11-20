"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import SectionCard from "@/components/layout/SectionCard";
import DataTable from "@/components/tables/DataTable";
import { AddRowButton } from "@/components/tables/InlineRowCells";
import Pager from "@/components/tables/Pager";
import { InputBar, SelectBar } from "@/components/ui/InputBars";
import RetailerDialog from "@/components/shops/RetailerDialog";
import { formatPhone } from "@/components/shops/ShopParts";
import { formatCurrency, formatDate } from "@/lib/format";
import useShops, { useDebounced, useShopLabels, useShopsChanged } from "@/lib/hooks/useShops";

// The shops at the desk: who each one is, who sells to it, its beat, its last order and what it
// owes, the latest to order first, a page at a time from the server. A row opens the shop (report,
// orders, outstanding); the pencil opens every field in a dialog.
export default function RetailersPanel() {
  const router = useRouter();
  const { salesmen, beats } = useShopLabels();
  const shopsChanged = useShopsChanged();
  const [searchText, setSearchText] = useState("");
  const search = useDebounced(searchText.trim());
  const [salesmanId, setSalesmanId] = useState("");
  const [beatId, setBeatId] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  // The shop in the dialog: a retailer, "new", or null when the dialog is shut.
  const [editing, setEditing] = useState(null);
  const { shops, total, error, isPending, isPlaceholderData } = useShops({ search, salesmanId, beatId, page, pageSize });
  // A new search or filter starts again from page 1.
  const [filterKey, setFilterKey] = useState("");
  const key = [search, salesmanId, beatId, pageSize].join("|");
  if (key !== filterKey) {
    setFilterKey(key);
    setPage(1);
  }

  const columns = useMemo(
    () => [
      {
        header: "Retailer",
        accessorKey: "name",
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link href={`/app/retailers/${row.original.id}`} className="font-medium text-ink hover:underline">
              {row.original.name || "—"}
            </Link>
            <p className="truncate text-xs text-muted">{[row.original.address_line1, row.original.city].filter(Boolean).join(", ") || "No address"}</p>
          </div>
        )
      },
      { header: "Phone", accessorKey: "mobile_number", cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{formatPhone(row.original.mobile_number) || "—"}</span> },
      { header: "Salesman", accessorKey: "salesman_name", cell: ({ row }) => row.original.salesman_name || "—" },
      { header: "Beat", accessorKey: "beat_name", cell: ({ row }) => row.original.beat_name || "—" },
      { header: "Last order", accessorKey: "last_order_at", cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{row.original.last_order_at ? formatDate(row.original.last_order_at) : "Never"}</span> },
      {
        header: "Owed",
        accessorKey: "outstanding",
        meta: { type: "number" },
        cell: ({ row }) => (
          <span className={`tabular-nums ${row.original.outstanding > 0 ? "font-semibold text-[#5e0b26]" : "text-muted"}`}>
            {row.original.outstanding > 0 ? formatCurrency(row.original.outstanding) : "—"}
          </span>
        )
      },
      {
        header: "",
        id: "actions",
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => setEditing(row.original)}
            aria-label={`Edit ${row.original.name || "retailer"}`}
            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md border border-control text-muted hover:bg-raised hover:text-ink"
          >
            <Pencil className="size-4" strokeWidth={2} />
          </button>
        )
      }
    ],
    []
  );

  if (error) {
    return <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error.message || "Unable to load retailers."}</p>;
  }

  return (
    <SectionCard
      title="Shops"
      subtitle={isPending ? "Loading shops…" : `${total} ${total === 1 ? "shop" : "shops"}`}
      actions={
        <>
          <AddRowButton label="+ Add retailer" onClick={() => setEditing("new")} />
          <select
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value))}
            aria-label="Rows per page"
            className="h-9 cursor-pointer rounded-md border border-control bg-white px-3 text-sm text-ink"
          >
            {[25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
        </>
      }
    >
      <div className="mb-3 grid grid-cols-3 gap-2">
        <InputBar
          type="text"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Search name, address, phone or GST"
        />
        <SelectBar
          value={salesmanId}
          aria-label="Filter by salesman"
          onChange={(event) => setSalesmanId(event.target.value)}
        >
          <option value="">All salesmen</option>
          {salesmen.map((salesman) => (
            <option key={salesman.id} value={salesman.id}>
              {salesman.name}
            </option>
          ))}
        </SelectBar>
        <SelectBar
          value={beatId}
          aria-label="Filter by beat"
          onChange={(event) => setBeatId(event.target.value)}
        >
          <option value="">All beats</option>
          <option value="none">No beat</option>
          {beats.map((beat) => (
            <option key={beat.id} value={beat.id}>
              {beat.name}
            </option>
          ))}
        </SelectBar>
      </div>
      <div className={isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
        <DataTable columns={columns} data={shops} onRowClick={(shop) => router.push(`/app/retailers/${shop.id}`)} emptyLabel={isPending ? "Loading shops…" : "No retailers match."} tableClassName="[&_td:first-child]:max-w-[28rem]" />
      </div>
      <Pager page={page} pageSize={pageSize} total={total} noun="shops" onChange={setPage} />
      {editing ? (
        <RetailerDialog
          retailer={editing === "new" ? null : editing}
          salesmen={salesmen}
          beats={beats}
          onClose={() => setEditing(null)}
          onSaved={shopsChanged}
        />
      ) : null}
    </SectionCard>
  );
}
