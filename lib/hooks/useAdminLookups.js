"use client";

import { useCallback, useEffect, useState } from "react";
import { apiEndpoints, apiFetch, apiFetchCached, invalidateApiCache } from "@/lib/api";

const emptyLookups = {
  retailers: [],
  skus: [],
  warehouses: [],
  salesmen: [],
  warehouseManagers: [],
  brands: []
};

function normalizeLookups(response) {
  return {
    retailers: response?.retailers || [],
    skus: response?.skus || [],
    warehouses: response?.warehouses || [],
    salesmen: response?.salesmen || [],
    warehouseManagers: response?.warehouse_managers || [],
    brands: response?.brands || []
  };
}

export default function useAdminLookups({ errorMessage } = {}) {
  const [lookups, setLookups] = useState(emptyLookups);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchLookups = useCallback(async ({ showLoading } = { showLoading: false }) => {
    if (showLoading) setLoading(true);
    try {
      const response = await apiFetch(apiEndpoints.admin.lookups);
      setLookups(normalizeLookups(response));
      setError("");
    } catch (err) {
      setError(err?.message || errorMessage || "Unable to load lookups.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [errorMessage]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await apiFetchCached(apiEndpoints.admin.lookups);
        if (!active) return;
        setLookups(normalizeLookups(response));
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err?.message || errorMessage || "Unable to load lookups.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [errorMessage]);

  const refreshLookups = useCallback(async () => {
    invalidateApiCache(apiEndpoints.admin.lookups);
    await fetchLookups();
  }, [fetchLookups]);

  return {
    ...lookups,
    loading,
    error,
    refreshLookups
  };
}
