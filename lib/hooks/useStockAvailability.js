"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiEndpoints, apiFetch } from "@/lib/api";

const EMPTY = {};

/**
 * Allocatable units per SKU at one warehouse, for the order form's line items.
 *
 * Deliberately `apiFetch`, never `apiFetchCached`: a stock figure is only worth showing if
 * it is the one the allocator would honour right now, and the 5-minute lookups cache would
 * hand back a number old enough to be wrong. Refetches whenever the warehouse or the set of
 * chosen SKUs changes.
 *
 * Advisory only. POST /orders re-checks under FOR UPDATE and stays the authority — the
 * form never blocks a submit on this number, because a stale client-side block is the very
 * failure this display exists to prevent.
 */
export default function useStockAvailability(warehouseId, skuIds) {
  const [fetched, setFetched] = useState(EMPTY);
  // Serialised so the effect keys off the contents, not the array identity.
  const skuKey = skuIds.join(",");

  useEffect(() => {
    let active = true;
    async function load() {
      const ids = skuKey.split(",").filter(Boolean);
      if (!warehouseId || !ids.length) return;
      try {
        const response = await apiFetch(apiEndpoints.orders.availability(warehouseId, ids));
        if (!active) return;
        setFetched(response?.available || EMPTY);
      } catch {
        // A missing hint must never block order entry; the server still enforces stock.
        if (active) setFetched(EMPTY);
      }
    }
    load();
    return () => {
      // Switching warehouse twice in quick succession must not let the first response
      // land last and describe a warehouse the operator has moved on from.
      active = false;
    };
  }, [warehouseId, skuKey]);

  const refreshAvailability = useCallback(async () => {
    const ids = skuKey.split(",").filter(Boolean);
    if (!warehouseId || !ids.length) return;
    try {
      const response = await apiFetch(apiEndpoints.orders.availability(warehouseId, ids));
      setFetched(response?.available || EMPTY);
    } catch {
      setFetched(EMPTY);
    }
  }, [warehouseId, skuKey]);

  // Derived, not stored, so clearing the warehouse blanks the figures on the same render
  // rather than leaving the previous warehouse's stock on screen.
  const available = useMemo(
    () => (warehouseId && skuKey ? fetched : EMPTY),
    [warehouseId, skuKey, fetched]
  );

  return { available, refreshAvailability };
}
