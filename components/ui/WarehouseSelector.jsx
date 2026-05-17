"use client";

import { useEffect, useState } from "react";
import { apiEndpoints, apiFetchCached } from "@/lib/api";

export default function WarehouseSelector({ value, onChange }) {
  const [warehouses, setWarehouses] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetchCached(apiEndpoints.admin.lookups);
        setWarehouses(data?.warehouses || []);
      } catch {
        setWarehouses([]);
      }
    }
    load();
  }, []);

  if (!warehouses.length) return null;

  const options = [{ id: null, label: "All Warehouses" }, ...warehouses.map((w) => ({ id: w.id, label: w.name }))];

  return (
    <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1">
      {options.map((opt) => {
        const isActive = value === opt.id;
        return (
          <button
            key={opt.id ?? "all"}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200 ${
              isActive
                ? "bg-[#1a1b2e] text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
