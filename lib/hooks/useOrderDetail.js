"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiEndpoints } from "@/lib/api";
import { needsRiderList } from "@/lib/policy";
import { invalidateOrders, queryPath } from "@/lib/query";

// One order and, for roles that can send it out, the riders to choose from. The phone screen
// (OrderScreen) and the desk (OrderDesk) both read through this, so they load and refresh alike.
//
// /admin/drivers is open only to the roles that can assign a rider, so it is fetched only for them:
// fetching it for every viewer was a guaranteed 403 for riders, salesmen and accountants.
export default function useOrderDetail(orderId, role) {
  const queryClient = useQueryClient();
  const orderQuery = useQuery({ queryKey: queryPath(apiEndpoints.orders.detail(orderId)), enabled: Boolean(orderId) });
  // A failed rider list must not block the order: it shows with an empty rider picker.
  const driversQuery = useQuery({
    queryKey: queryPath(apiEndpoints.admin.drivers),
    enabled: needsRiderList(role),
    staleTime: 60_000,
  });

  return {
    order: orderQuery.data ?? null,
    drivers: driversQuery.data || [],
    loading: orderQuery.isPending && Boolean(orderId),
    error: orderQuery.error ? orderQuery.error.message || "Unable to load order details." : "",
    // After a status change or a payment: this order and everything it feeds (the lists, the queue
    // counts, the dashboard, what shops owe) refetch.
    reload: () => invalidateOrders(queryClient),
  };
}
