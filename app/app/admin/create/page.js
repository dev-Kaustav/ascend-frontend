"use client";

import { useEffect, useState } from "react";
import { apiEndpoints, apiFetchCached } from "@/lib/api";
import QuickCreatePanel from "@/components/admin/QuickCreatePanel";

export default function AdminCreate() {
  const [salesmen, setSalesmen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await apiFetchCached(apiEndpoints.admin.salesmen);
        if (!active) return;
        setSalesmen(data || []);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Unable to load lookups.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <QuickCreatePanel
        title="Quick create"
        subtitle="Add entities without leaving this page."
        entities={["warehouse", "retailer", "sku"]}
        salesmen={salesmen}
        headerError={error}
      />
    </div>
  );
}
