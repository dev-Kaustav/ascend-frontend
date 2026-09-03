"use client";

import { useCallback, useEffect, useState } from "react";
import { apiEndpoints, apiFetch, apiFetchCached, invalidateApiCache } from "@/lib/api";

// Order-form lookups from /orders/lookups, which the backend scopes by role: a salesman
// receives only the retailers assigned to them, so the form cannot offer a retailer the
// POST would reject. Deliberately narrower than useAdminLookups — no salesmen, warehouse
// managers, drivers or beats, because /admin/lookups is closed to SALESMAN.
const emptyLookups = {
  retailers: [],
  skus: [],
  warehouses: [],
  brands: []
};

function normalizeLookups(response) {
  return {
    retailers: response?.retailers || [],
    skus: response?.skus || [],
    warehouses: response?.warehouses || [],
    brands: response?.brands || []
  };
}

export default function useOrderFormLookups({ errorMessage } = {}) {
  const [lookups, setLookups] = useState(emptyLookups);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchLookups = useCallback(async () => {
    try {
      const response = await apiFetch(apiEndpoints.orders.lookups);
      setLookups(normalizeLookups(response));
      setError("");
    } catch (err) {
      setError(err?.message || errorMessage || "Unable to load lookups.");
    }
  }, [errorMessage]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await apiFetchCached(apiEndpoints.orders.lookups);
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
    invalidateApiCache(apiEndpoints.orders.lookups);
    await fetchLookups();
  }, [fetchLookups]);

  return {
    ...lookups,
    loading,
    error,
    refreshLookups
  };
}
