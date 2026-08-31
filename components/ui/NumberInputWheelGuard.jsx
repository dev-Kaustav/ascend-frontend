"use client";

import { useEffect } from "react";

/**
 * Stops the mouse wheel from silently changing the value of a focused
 * <input type="number">. Blurring rather than preventing the event keeps the
 * page scrolling normally — only the value change is dropped.
 */
export default function NumberInputWheelGuard() {
  useEffect(() => {
    const handleWheel = (event) => {
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement &&
        active.type === "number" &&
        active === event.target
      ) {
        active.blur();
      }
    };
    document.addEventListener("wheel", handleWheel);
    return () => document.removeEventListener("wheel", handleWheel);
  }, []);

  return null;
}
