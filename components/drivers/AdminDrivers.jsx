"use client";

import { useEffect, useMemo, useState } from "react";
import { apiEndpoints, apiFetch, apiFetchCached } from "@/lib/api";
import SectionCard from "@/components/layout/SectionCard";
import DataTable from "@/components/tables/DataTable";

export default function AdminDrivers() {
  const [drivers, setDrivers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDrivers() {
    setLoading(true);
    try {
      const [driversResponse, lookupsResponse] = await Promise.all([
        apiFetch(apiEndpoints.admin.drivers),
        apiFetchCached(apiEndpoints.admin.lookups)
      ]);
      setDrivers(driversResponse || []);
      setWarehouses(lookupsResponse?.warehouses || []);
      setError("");
    } catch (err) {
      setError(err?.message || "Unable to load drivers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDrivers();
  }, []);

  const warehouseMap = useMemo(() => {
    const map = new Map();
    warehouses.forEach((warehouse) => {
      map.set(warehouse.id, warehouse.name);
    });
    return map;
  }, [warehouses]);

  const columns = useMemo(
    () => [
      {
        header: "Driver",
        accessorKey: "name",
        cell: ({ row }) => row.original.name
      },
      {
        header: "Email",
        accessorKey: "email",
        cell: ({ row }) => row.original.email
      },
      {
        header: "Warehouse",
        accessorKey: "warehouse_id",
        cell: ({ row }) =>
          warehouseMap.get(row.original.warehouse_id) || row.original.warehouse_id || "—"
      }
    ],
    [warehouseMap]
  );

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
        Loading drivers…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard title="Delivery Drivers" subtitle={`${drivers.length} drivers`}>
        {error ? <p className="mb-3 text-sm text-rose-500">{error}</p> : null}
        <DataTable columns={columns} data={drivers} emptyLabel="No drivers created yet." />
      </SectionCard>
    </div>
  );
}
