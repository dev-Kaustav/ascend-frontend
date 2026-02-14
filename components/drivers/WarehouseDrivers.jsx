"use client";

import { useEffect, useMemo, useState } from "react";
import { apiEndpoints, apiFetchCached } from "@/lib/api";
import SectionCard from "@/components/layout/SectionCard";
import DataTable from "@/components/tables/DataTable";

export default function WarehouseDrivers() {
  const [drivers, setDrivers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [driversResponse, lookupsResponse] = await Promise.all([
          apiFetchCached(apiEndpoints.admin.drivers, { ttl: 60000 }),
          apiFetchCached(apiEndpoints.admin.lookups)
        ]);
        if (!active) return;
        setDrivers(driversResponse || []);
        setWarehouses(lookupsResponse?.warehouses || []);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Unable to load drivers.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
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

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-600">
        {error}
      </div>
    );
  }

  return (
    <SectionCard title="Delivery Drivers" subtitle={`${drivers.length} drivers`}>
      <DataTable columns={columns} data={drivers} emptyLabel="No drivers created yet." />
    </SectionCard>
  );
}
