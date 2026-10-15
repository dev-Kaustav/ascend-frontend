"use client";

import { useEffect, useMemo, useState } from "react";
import { apiEndpoints, apiFetch, apiFetchCached } from "@/lib/api";
import { formatDate, toTitleCase } from "@/lib/format";
import FieldFeedback from "@/components/field/FieldFeedback";
import FieldOrderCard from "@/components/field/FieldOrderCard";
import FieldStatusFilters from "@/components/field/FieldStatusFilters";
import SectionCard from "@/components/layout/SectionCard";
import DataTable from "@/components/tables/DataTable";
import OrderDetailPanel from "@/components/orders/OrderDetailPanel";

function getOrderDate(order) {
  return order?.created_at || order?.order_date || order?.date || null;
}

export default function WarehouseOrders() {
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState({ status: "PENDING" });
  const [updates, setUpdates] = useState({});
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  async function loadOrders(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(pageSize));
      params.set("offset", String((page - 1) * pageSize));
      if (filters.status !== "ALL") params.set("status", filters.status);

      const [ordersResponse, driversResponse, lookupsResponse] = await Promise.all([
        apiFetch(`${apiEndpoints.admin.orders}?${params.toString()}`),
        apiFetchCached(apiEndpoints.admin.drivers, { ttl: 60000 }),
        apiFetchCached(apiEndpoints.admin.lookups)
      ]);
      setOrders(ordersResponse?.items || []);
      setTotal(ordersResponse?.total || 0);
      setDrivers(driversResponse || []);
      setWarehouses(lookupsResponse?.warehouses || []);
      setRetailers(lookupsResponse?.retailers || []);
      setError("");
    } catch (err) {
      setError(err?.message || "Unable to load orders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, [page, pageSize, filters]);

  const warehouseMap = useMemo(() => {
    const map = new Map();
    warehouses.forEach((warehouse) => {
      map.set(warehouse.id, warehouse.name);
    });
    return map;
  }, [warehouses]);

  const retailerMap = useMemo(() => {
    const map = new Map();
    retailers.forEach((retailer) => {
      map.set(retailer.id, retailer.name);
    });
    return map;
  }, [retailers]);

  const driverMap = useMemo(() => {
    const map = new Map();
    drivers.forEach((driver) => {
      map.set(driver.id, driver.name);
    });
    return map;
  }, [drivers]);

  function updateRow(orderId, patch) {
    setUpdates((prev) => ({ ...prev, [orderId]: { ...prev[orderId], ...patch } }));
  }

  async function handleUpdate(orderId) {
    const update = updates[orderId] || {};
    const status = update.status;
    if (!status) {
      updateRow(orderId, { error: "Select a status before updating." });
      return;
    }
    updateRow(orderId, { saving: true, error: "" });
    try {
      await apiFetch(apiEndpoints.orders.updateStatus(orderId), {
        method: "PATCH",
        body: JSON.stringify({
          status,
          delivery_driver_id: update.deliveryDriverId ? Number(update.deliveryDriverId) : null,
          payment_status: update.paymentStatus || null,
          payment_mode: update.paymentMode || null,
          payment_amount: update.paymentAmount ? Number(update.paymentAmount) : null
        })
      });
      updateRow(orderId, { saving: false, error: "", status: "", deliveryDriverId: "" });
      await loadOrders(false);
    } catch (err) {
      updateRow(orderId, { saving: false, error: err?.payload?.detail || "Update failed." });
    }
  }

  const columns = useMemo(
    () => [
      {
        header: "Order ID",
        accessorKey: "id",
        cell: ({ row }) => <span className="font-semibold text-slate-900">#{row.original.id}</span>
      },
      {
        header: "Warehouse",
        accessorKey: "from_entity_id",
        cell: ({ row }) => warehouseMap.get(row.original.from_entity_id) || row.original.from_entity_id || "—"
      },
      {
        header: "Retailer",
        accessorKey: "to_entity_id",
        cell: ({ row }) => retailerMap.get(row.original.to_entity_id) || row.original.to_entity_id || "—"
      },
      {
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => toTitleCase(row.original.status)
      },
      {
        header: "Driver",
        accessorKey: "delivery_driver_id",
        cell: ({ row }) =>
          driverMap.get(row.original.delivery_driver_id) || row.original.delivery_driver_id || "—"
      },
      {
        header: "Order Date",
        accessorKey: "created_at",
        cell: ({ row }) => formatDate(getOrderDate(row.original))
      },
      {
        header: "Assign & Update",
        accessorKey: "actions",
        cell: ({ row }) => {
          const orderId = row.original.id;
          const rowUpdate = updates[orderId] || {};
          const showDriverPicker = rowUpdate.status === "READY_TO_SHIP";
          return (
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center gap-2">
                <select
                  aria-label={`Set status for order ${orderId}`}
                  value={rowUpdate.status || ""}
                  onChange={(event) => updateRow(orderId, { status: event.target.value, deliveryDriverId: "" })}
                  className="rounded-full border border-slate-200 bg-white px-2 py-1"
                >
                  <option value="">Set status</option>
                  <option value="READY_TO_SHIP">Ready to ship</option>
                  <option value="OUT_FOR_DELIVERY">Out for delivery</option>
                  <option value="CANCELLED">Cancel order</option>
                </select>
                <button
                  type="button"
                  onClick={() => handleUpdate(orderId)}
                  disabled={rowUpdate.saving}
                  className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white disabled:opacity-60"
                >
                  {rowUpdate.saving ? "Saving" : "Update"}
                </button>
              </div>
              {showDriverPicker && (
                <select
                  aria-label={`Assign driver for order ${orderId}`}
                    value={rowUpdate.deliveryDriverId || ""}
                  onChange={(event) => updateRow(orderId, { deliveryDriverId: event.target.value })}
                  className="rounded-full border border-slate-200 bg-white px-2 py-1"
                >
                  <option value="">Assign driver (required)</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name}
                    </option>
                  ))}
                </select>
              )}
              {rowUpdate.error ? <span className="text-rose-500">{rowUpdate.error}</span> : null}
            </div>
          );
        }
      }
    ],
    [warehouseMap, retailerMap, driverMap, drivers, updates]
  );

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
        Loading orders…
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
      <SectionCard
        title="Warehouse Orders"
        subtitle="Allocate stock, assign drivers, and update delivery status."
        actions={
          <button
            type="button"
            onClick={() => loadOrders(false)}
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500"
          >
            Refresh
          </button>
        }
      >
        <FieldStatusFilters value={filters.status} onChange={(status) => { setFilters({ status }); setPage(1); }} />
        <div className="hidden gap-4 md:grid-cols-2 lg:grid">
          <select
            value={filters.status}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, status: event.target.value }));
              setPage(1);
            }}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="READY_TO_SHIP">Ready to ship</option>
            <option value="OUT_FOR_DELIVERY">Out for delivery</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </SectionCard>

      <SectionCard
        className="field-list-section"
        title="Orders"
        subtitle={`${total} ${total === 1 ? "order" : "orders"}`}
        actions={
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500"
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
        }
      >
        <DataTable renderMobileRow={(order, renderCell) => <FieldOrderCard order={{ ...order, retailer_name: retailerMap.get(order.to_entity_id) }}>{renderCell("actions")}</FieldOrderCard>} columns={columns} data={orders} emptyLabel="No orders match the selected filter." onRowClick={(order) => setSelectedOrderId(order.id)} />
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
      {selectedOrderId ? (
        <div className="field-detail-overlay fixed inset-0 z-50 flex justify-end bg-slate-950/30 p-0 sm:p-4">
          <button
            type="button"
            aria-label="Close order detail"
            className="absolute inset-0 cursor-default"
            onClick={() => setSelectedOrderId(null)}
          />
          <aside className="relative h-dvh w-full overflow-y-auto border-l border-slate-200 bg-slate-50 p-4 shadow-xl sm:max-w-5xl sm:rounded-lg sm:border">
            <OrderDetailPanel
              orderId={selectedOrderId}
              onClose={() => setSelectedOrderId(null)}
              onOrderUpdate={() => loadOrders(false)}
            />
          </aside>
        </div>
      ) : null}
    </div>
  );
}
