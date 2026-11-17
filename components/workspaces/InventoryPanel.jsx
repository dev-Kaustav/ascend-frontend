"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiEndpoints, apiFetch, apiFetchCached } from "@/lib/api";
import { formatCount, formatDate } from "@/lib/format";
import SectionCard from "@/components/layout/SectionCard";
import DataTable from "@/components/tables/DataTable";
import SkuCell from "@/components/ui/SkuCell";

import { roleCanManageInventory } from "@/lib/workspaceRoutes";
import { useAuth } from "@/components/auth/AuthProvider";

function getExpiry(item) {
  return item.earliest_expiry || item.expiry_date || null;
}

function daysToExpiry(expiry) {
  if (!expiry) return null;
  const expiryDate = new Date(expiry);
  const diff = expiryDate.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function WarehouseInventory() {
  const [inventory, setInventory] = useState([]);
  const [skus, setSkus] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("ALL");
  const [lookupsLoaded, setLookupsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { role } = useAuth();
  const canManage = roleCanManageInventory(role);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", String(pageSize));
        params.set("offset", String((page - 1) * pageSize));
        if (selectedWarehouseId !== "ALL") {
          params.set("warehouse_id", String(selectedWarehouseId));
        }

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
  }, [page, pageSize, lookupsLoaded, selectedWarehouseId]);

  const skuMap = useMemo(() => {
    const map = new Map();
    skus.forEach((sku) => {
      map.set(sku.id, sku);
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

  const warehouseFilters = useMemo(() => {
    const base = (warehouses || [])
      .map((warehouse) => ({ id: warehouse.id, label: warehouse.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return [{ id: "ALL", label: "All warehouses" }, ...base];
  }, [warehouses]);

  const inventoryRows = useMemo(() => {
    return inventory.map((item) => ({
      ...item,
      sku: skuMap.get(item.sku_id),
      sku_name: skuMap.get(item.sku_id)?.name || item.sku_name,
      warehouse_name: warehouseMap.get(item.warehouse_id),
      expiry_date: getExpiry(item),
      days_to_expiry: daysToExpiry(getExpiry(item))
    }));
  }, [inventory, skuMap, warehouseMap]);

  // Units on hand per SKU across warehouses, most first.
  const bySku = useMemo(() => {
    const grouped = new Map();
    inventory.forEach((item) => {
      const current = grouped.get(item.sku_id) || { skuId: item.sku_id, sku: skuMap.get(item.sku_id), name: item.sku_name, quantity: 0 };
      current.quantity += item.total_quantity || 0;
      grouped.set(item.sku_id, current);
    });
    return Array.from(grouped.values()).sort((a, b) => b.quantity - a.quantity);
  }, [inventory, skuMap]);
  const bySkuMax = Math.max(1, ...bySku.map((row) => row.quantity));

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
        cell: ({ row }) => <SkuCell sku={row.original.sku} name={row.original.sku_name} />
      },
      {
        header: "Warehouse",
        accessorKey: "warehouse_id",
        cell: ({ row }) => row.original.warehouse_name || row.original.warehouse_id || "—"
      },
      {
        header: "Total",
        accessorKey: "total_quantity",
        meta: { type: "number" },
        cell: ({ row }) => formatCount(row.original.total_quantity)
      },
      {
        // What the allocator would actually honour: physical stock less what is reserved
        // and less what has expired. This column used to show total_quantity, so an order
        // could be refused for stock the screen said was there.
        header: "Available",
        accessorKey: "available_quantity",
        meta: { type: "number" },
        cell: ({ row }) => formatCount(row.original.available_quantity)
      },
      {
        header: "Expired",
        accessorKey: "expired_quantity",
        meta: { type: "number" },
        cell: ({ row }) => {
          const expired = row.original.expired_quantity || 0;
          return (
            <span className={expired > 0 ? "font-semibold text-amber-700" : undefined}>
              {formatCount(expired)}
            </span>
          );
        }
      },
      {
        header: "Reserved",
        accessorKey: "reserved_quantity",
        meta: { type: "number" },
        cell: ({ row }) => formatCount(row.original.reserved_quantity)
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
  const pillButtonClass = "rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-widest";

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
      {/* items-start: a short list keeps its own height instead of stretching into a blank card. */}
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <SectionCard title="Stock by SKU" subtitle="Units on hand, most first">
          {bySku.length ? (
            <ul className="space-y-3">
              {bySku.slice(0, 8).map((row) => (
                <li key={row.skuId}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <SkuCell sku={row.sku} name={row.name} size="sm" />
                    <span className="shrink-0 tabular-nums text-ink">{formatCount(row.quantity)}</span>
                  </div>
                  <div className="ml-11 mt-1 h-0.5 rounded-full bg-raised">
                    <div className="h-0.5 rounded-full bg-ink" style={{ width: `${(row.quantity / bySkuMax) * 100}%` }} />
                  </div>
                </li>
              ))}
              {bySku.length > 8 ? <li className="text-xs text-muted">{bySku.length - 8} more in the table below</li> : null}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-400">No stock recorded.</div>
          )}
        </SectionCard>
        <SectionCard title="Near-expiry batches" subtitle="Less than 30 days to expiry">
          {nearExpiry.length ? (
            <div className="space-y-3">
              {nearExpiry.slice(0, 6).map((item) => (
                <div
                  key={`${item.sku_id}-${item.warehouse_id}`}
                  className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700"
                >
                  <SkuCell
                    sku={item.sku}
                    name={item.sku_name}
                    size="sm"
                    sub={`${item.days_to_expiry} days left · ${item.warehouse_name || `WH ${item.warehouse_id}`}`}
                  />
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
                <div
                  key={`${item.sku_id}-${item.warehouse_id}`}
                  className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
                >
                  <SkuCell sku={item.sku} name={item.sku_name} size="sm" sub={item.warehouse_name || `WH ${item.warehouse_id}`} />
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
            {canManage ? (
              <Link
                href="/app/operations/inventory/add"
                className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white"
              >
                Add Inventory
              </Link>
            ) : null}
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
        <div className="mb-3 flex flex-wrap gap-2">
          {warehouseFilters.map((option) => {
            const isActive = selectedWarehouseId === option.id;
            return (
              <button
                key={`${option.label}-${option.id}`}
                type="button"
                onClick={() => {
                  setSelectedWarehouseId(option.id);
                  setPage(1);
                }}
                className={`${pillButtonClass} transition ${
                  isActive ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
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
