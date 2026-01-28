"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiEndpoints, apiFetch, apiFetchCached } from "@/lib/api";
import { formatDate, formatNumber } from "@/lib/format";
import SectionCard from "@/components/layout/SectionCard";
import DataTable from "@/components/tables/DataTable";
import BarChartCard from "@/components/charts/BarChartCard";

function getExpiry(item) {
  return item.earliest_expiry || item.expiry_date || null;
}

function daysToExpiry(expiry) {
  if (!expiry) return null;
  const expiryDate = new Date(expiry);
  const diff = expiryDate.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function AdminInventory() {
  const [inventory, setInventory] = useState([]);
  const [skus, setSkus] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [lookupsLoaded, setLookupsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", String(pageSize));
        params.set("offset", String((page - 1) * pageSize));

        const lookupsPromise = lookupsLoaded ? Promise.resolve(null) : apiFetchCached(apiEndpoints.admin.lookups);
        const [inventoryResponse, lookupsResponse] = await Promise.all([
          apiFetch(`${apiEndpoints.admin.inventory}?${params.toString()}`),
          lookupsPromise
        ]);
        if (!active) return;
        const inventoryItems = inventoryResponse?.items || inventoryResponse || [];
        setInventory(inventoryItems);
        setTotal(inventoryResponse?.total ?? inventoryItems.length);
        if (lookupsResponse) {
          setSkus(lookupsResponse?.skus || []);
          setWarehouses(lookupsResponse?.warehouses || []);
          setLookupsLoaded(true);
        }
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Unable to load inventory.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [page, pageSize]);

  const skuMap = useMemo(() => {
    const map = new Map();
    skus.forEach((sku) => {
      map.set(sku.id, sku.name);
    });
    return map;
  }, [skus]);

  const warehouseMap = useMemo(() => {
    const map = new Map();
    warehouses.forEach((warehouse) => {
      map.set(warehouse.id, warehouse.name);
    });
    return map;
  }, [warehouses]);

  const inventoryRows = useMemo(() => {
    return inventory.map((item) => ({
      ...item,
      sku_name: skuMap.get(item.sku_id),
      warehouse_name: warehouseMap.get(item.warehouse_id),
      expiry_date: getExpiry(item),
      days_to_expiry: daysToExpiry(getExpiry(item))
    }));
  }, [inventory, skuMap, warehouseMap]);

  const bySku = useMemo(() => {
    const grouped = new Map();
    inventory.forEach((item) => {
      const label = skuMap.get(item.sku_id) || item.sku_name || `SKU ${item.sku_id}`;
      const current = grouped.get(label) || { label, quantity: 0 };
      current.quantity += item.total_quantity || 0;
      grouped.set(label, current);
    });
    return Array.from(grouped.values());
  }, [inventory, skuMap]);

  const nearExpiry = useMemo(() => {
    return inventoryRows.filter((item) => item.days_to_expiry !== null && item.days_to_expiry < 30);
  }, [inventoryRows]);

  const zeroStock = useMemo(() => {
    return inventoryRows.filter((item) => (item.total_quantity || 0) <= 0);
  }, [inventoryRows]);

  const columns = useMemo(
    () => [
      {
        header: "SKU",
        accessorKey: "sku_id",
        cell: ({ row }) => row.original.sku_name || `SKU ${row.original.sku_id}`
      },
      {
        header: "Warehouse",
        accessorKey: "warehouse_id",
        cell: ({ row }) => row.original.warehouse_name || row.original.warehouse_id || "—"
      },
      {
        header: "Available",
        accessorKey: "total_quantity",
        cell: ({ row }) => formatNumber(row.original.total_quantity)
      },
      {
        header: "Reserved",
        accessorKey: "quantity_reserved",
        cell: ({ row }) => formatNumber(row.original.quantity_reserved)
      },
      {
        header: "Damaged",
        accessorKey: "quantity_damaged",
        cell: ({ row }) => formatNumber(row.original.quantity_damaged)
      },
      {
        header: "Earliest Expiry",
        accessorKey: "expiry_date",
        cell: ({ row }) => formatDate(row.original.expiry_date)
      },
      {
        header: "Days to Expiry",
        accessorKey: "days_to_expiry",
        cell: ({ row }) => (row.original.days_to_expiry !== null ? `${row.original.days_to_expiry} days` : "—")
      }
    ],
    []
  );

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
        Loading inventory…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-600">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <BarChartCard
          title="Stock by SKU"
          subtitle="Total quantity on hand"
          data={bySku}
          bars={[{ dataKey: "quantity", name: "Units", color: "#0ea5e9" }]}
        />
        <SectionCard title="Near-expiry batches" subtitle="Less than 30 days to expiry">
          {nearExpiry.length ? (
            <div className="space-y-3">
              {nearExpiry.slice(0, 6).map((item) => (
                <div key={`${item.sku_id}-${item.warehouse_id}`} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                  <p className="font-semibold">{item.sku_name || `SKU ${item.sku_id}`}</p>
                  <p className="text-xs">
                    {item.days_to_expiry} days • {item.warehouse_name || `WH ${item.warehouse_id}`}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-400">
              No near-expiry batches found.
            </div>
          )}
        </SectionCard>
        <SectionCard title="Zero stock SKUs" subtitle="Items to replenish">
          {zeroStock.length ? (
            <div className="space-y-3">
              {zeroStock.slice(0, 6).map((item) => (
                <div key={`${item.sku_id}-${item.warehouse_id}`} className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  <p className="font-semibold">{item.sku_name || `SKU ${item.sku_id}`}</p>
                  <p className="text-xs">{item.warehouse_name || `WH ${item.warehouse_id}`}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-400">
              No zero-stock SKUs.
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Inventory by Warehouse"
        subtitle={`${total} inventory rows`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/app/admin/inventory/add"
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white"
            >
              Add Inventory
            </Link>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500"
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
          </div>
        }
      >
        <DataTable columns={columns} data={inventoryRows} emptyLabel="Inventory data is empty." />
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <span>
            Page {page} of {Math.max(1, Math.ceil(total / pageSize))}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
              className="rounded-full border border-slate-200 px-3 py-1 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => prev + 1)}
              disabled={page >= Math.ceil(total / pageSize)}
              className="rounded-full border border-slate-200 px-3 py-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
