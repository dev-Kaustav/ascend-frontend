"use client";

import { useSyncExternalStore } from "react";

// Whether the screen is at the desktop breakpoint (Tailwind's lg, 1024px), for the few places that
// render a different component there rather than restyling one. null on the server and during
// hydration, so callers can render nothing until the width is known instead of mounting (and
// fetching for) the wrong component first.
const QUERY = "(min-width: 1024px)";

function subscribe(callback) {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

export default function useIsDesktop() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => null);
}
