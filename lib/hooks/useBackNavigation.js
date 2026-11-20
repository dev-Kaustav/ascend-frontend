"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

// The app header's back arrow: back to the screen this one was opened from (a shop, a beat, the
// orders list), or, when the screen was opened straight from a link, up to its parent. The
// browser's own history cannot tell the two apart, so the screens visited in this tab are kept
// here: a path equal to the one before last is a step back, anything else a step forward.
const visited = [];

export default function useBackNavigation(parentHref) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (visited.at(-1) === pathname) return;
    if (visited.at(-2) === pathname) visited.pop();
    else visited.push(pathname);
  }, [pathname]);

  return () => (visited.length > 1 ? router.back() : router.push(parentHref));
}
