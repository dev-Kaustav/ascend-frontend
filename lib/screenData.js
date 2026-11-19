import { apiEndpoints } from "@/lib/api";

// The exact API paths a screen reads on open, shared by the screen and by lib/prefetch.js. A
// prefetch only helps if it asks for the same string the screen will, so both build it here.
// Kept free of component imports so the app shell can load it without pulling a screen's chunk.

/** The admin dashboard's four reads, in panel order. `periodQuery` is "" for all time. */
export function adminDashboardPaths(periodQuery = "") {
  const withPeriod = (url) => (periodQuery ? `${url}?${periodQuery}` : url);
  return [
    withPeriod(apiEndpoints.admin.summary),
    apiEndpoints.admin.orderStatusSummary,
    apiEndpoints.admin.outstandingSummary,
    withPeriod(apiEndpoints.admin.dailySales),
  ];
}

export const ORDERS_QUEUE_PAGE_SIZE = 25;

/** What the orders queue reads when opened with no filters: the counts, page one, the salesmen. */
export function ordersQueueOpeningPaths() {
  return [
    apiEndpoints.admin.orderStatusSummary,
    `${apiEndpoints.admin.orders}?limit=${ORDERS_QUEUE_PAGE_SIZE}&offset=0`,
    apiEndpoints.admin.lookups,
  ];
}

// Per route, per role: the paths worth warming before the screen is opened. Only screens that read
// through the query cache are listed; prefetching for the others would be thrown away.
const ROUTE_DATA = {
  "/app/dashboard": { ADMIN: adminDashboardPaths },
  "/app/orders": { ADMIN: ordersQueueOpeningPaths, ACCOUNTANT: ordersQueueOpeningPaths },
};

export function routeDataPaths(href, role) {
  const route = ROUTE_DATA[href?.split("?")[0]];
  const build = route?.[role];
  return build ? build() : [];
}
