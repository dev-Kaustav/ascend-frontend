"use client";

import { QueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// The staff app's data cache (TanStack Query), in memory only: a full reload, and every sign-out
// (which reloads), starts empty. Nothing is written to localStorage, so a shared field phone keeps
// no one's orders or money once they leave.
//
// The query key is the API path itself, ["/admin/orders?limit=50"], so two screens asking for the
// same path share one response and one request, and a prefetch warms exactly what the screen will
// read. Pass the path through queryPath() wherever a key is built.
//
// Stale-while-revalidate: a screen opened again shows what it last had at once, then refreshes in
// the background when the copy is older than STALE_MS. Changes made in the app invalidate the
// paths they affect (invalidateOrders), so nobody waits out the window after their own edit.

const STALE_MS = 30_000;
const KEEP_MS = 10 * 60_000;

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        queryFn: ({ queryKey }) => apiFetch(queryKey[0]),
        staleTime: STALE_MS,
        gcTime: KEEP_MS,
        // An auth or validation failure does not fix itself on a second try.
        retry: (count, error) => count < 1 && !(error?.status >= 400 && error?.status < 500),
      },
    },
  });
}

/** The key for one API path; the same string the screen fetches. */
export function queryPath(path) {
  return [path];
}

/** Every cached response whose path starts with one of the prefixes is marked stale and refetched. */
export function invalidatePaths(queryClient, prefixes) {
  return queryClient.invalidateQueries({
    predicate: (query) => typeof query.queryKey[0] === "string" && prefixes.some((prefix) => query.queryKey[0].startsWith(prefix)),
  });
}

// What an order's status or payment changing can move: the order, the lists and queue counts, the
// dashboard figures and what shops owe.
const ORDER_DEPENDENT = ["/orders", "/admin/orders", "/admin/summary", "/dashboard/", "/accounting/", "/retailers"];

export function invalidateOrders(queryClient) {
  return invalidatePaths(queryClient, ORDER_DEPENDENT);
}
