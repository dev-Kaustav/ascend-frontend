"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiEndpoints, invalidateApiCache } from "@/lib/api";
import { invalidatePaths, queryPath } from "@/lib/query";

// One page of shops from the server (GET /retailers): it searches, filters and pages there, so no
// screen ever holds the whole list. The shop that ordered last comes first, for every role. Each row
// carries its salesman, beat, last order and what it owes. The previous page stays on screen while
// the next one loads.
export default function useShops({ search = "", salesmanId = "", beatId = null, page = 1, pageSize = 30 }) {
  const params = new URLSearchParams({ limit: String(pageSize), offset: String((page - 1) * pageSize) });
  if (search) params.set("search", search);
  if (salesmanId) params.set("salesman_id", String(salesmanId));
  if (beatId) params.set("beat_id", String(beatId));
  const query = useQuery({ queryKey: queryPath(`${apiEndpoints.retailers.list}?${params}`), placeholderData: keepPreviousData });
  const total = query.data?.total || 0;
  return { ...query, shops: query.data?.items || [], total, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

/** The value once it has stopped changing for `ms`: search waits for a pause in typing. */
export function useDebounced(value, ms = 300) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/** After a shop is added or changed: refetch the shop pages and drop the cached lookups the order
 * form and beats read, so the shop shows everywhere. */
export function useShopsChanged() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    invalidateApiCache(apiEndpoints.orders.lookups);
    invalidateApiCache(apiEndpoints.admin.lookups);
    return invalidatePaths(queryClient, [apiEndpoints.retailers.list, apiEndpoints.admin.lookups]);
  }, [queryClient]);
}

/** Salesmen and beats for the office's shop filters and forms, without the whole shop list that
 * /admin/lookups carries. */
export function useShopLabels(enabled = true) {
  const salesmen = useQuery({ queryKey: queryPath(apiEndpoints.admin.salesmen), enabled, staleTime: 60_000 });
  const beats = useQuery({ queryKey: queryPath(apiEndpoints.retailers.beats), enabled, staleTime: 60_000 });
  return {
    salesmen: salesmen.data || EMPTY,
    // /retailers/beats also lists the shops on no beat (id null); that is not a beat to pick.
    beats: useMemo(() => (beats.data || EMPTY).filter((beat) => beat.id != null), [beats.data])
  };
}

const EMPTY = [];
