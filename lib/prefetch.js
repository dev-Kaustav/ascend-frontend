"use client";

import { routeDataPaths } from "@/lib/screenData";

// Preloading, in priority order, never all at once (web.dev, "Prefetching, prerendering, and
// service worker precaching"; the Terra case study):
//   1. the screen in front of the user loads first, untouched by any of this;
//   2. once the browser is idle, the screens this role most often opens next are warmed one after
//      another, so a background request never competes with the visible one;
//   3. pointing at or touching a nav link warms that screen at once (intent), which covers the
//      rest of the menu without fetching screens nobody opens.
// Page code is already prefetched by next/link; this warms the data those pages read.
// Nothing is prefetched on Save-Data or a 2G connection: field phones on a thin signal or a
// small data pack keep their bandwidth for what they asked for.

const NEXT_SCREENS = {
  ADMIN: ["/app/orders", "/app/dashboard"],
  ACCOUNTANT: ["/app/orders"],
};

function connectionAllowsPrefetch() {
  const connection = typeof navigator !== "undefined" ? navigator.connection : null;
  if (!connection) return true;
  if (connection.saveData) return false;
  return !["slow-2g", "2g"].includes(connection.effectiveType);
}

function prefetchPaths(queryClient, paths) {
  // prefetchQuery skips a path whose cached copy is still fresh, so repeating this is cheap.
  return Promise.allSettled(paths.map((path) => queryClient.prefetchQuery({ queryKey: [path] })));
}

/** Warm one route's data now, for a hover, focus or touch on its link. */
export function prefetchRoute(queryClient, href, role) {
  if (!connectionAllowsPrefetch()) return;
  const paths = routeDataPaths(href, role);
  if (paths.length) prefetchPaths(queryClient, paths);
}

/**
 * After the current screen has settled, warm the role's likely next screens one at a time.
 * Returns a cancel function for the effect cleanup.
 */
export function prefetchNextScreensWhenIdle(queryClient, role) {
  if (!connectionAllowsPrefetch()) return () => {};
  // The screen already open is in the cache and fresh, so prefetchQuery skips it.
  const screens = NEXT_SCREENS[role] || [];
  let cancelled = false;
  const idle = window.requestIdleCallback || ((fn) => window.setTimeout(fn, 2000));
  const cancelIdle = window.cancelIdleCallback || window.clearTimeout;
  const handle = idle(async () => {
    // Idle means the main thread, not the network: wait for the visible screen's own requests to
    // finish so a warm-up never takes one of the browser's few connections from them.
    while (!cancelled && queryClient.isFetching() > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }
    for (const href of screens) {
      if (cancelled) return;
      await prefetchPaths(queryClient, routeDataPaths(href, role));
    }
  }, { timeout: 5000 });
  return () => {
    cancelled = true;
    cancelIdle(handle);
  };
}
