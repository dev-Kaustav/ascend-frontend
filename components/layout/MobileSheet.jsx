"use client";

import { useEffect } from "react";

// A bottom sheet for actions that need input before they can be submitted.
//
// Two order transitions cannot be reduced to a single tap: "Mark Ready to Ship" is
// rejected without a driver, and "Mark Delivered" carries cash collection. Those open
// this sheet from the action bar rather than losing their inputs.
//
// z-40/z-50 sit above the action bar (z-30) but the backdrop matches the nav drawer's
// z-40 so the stacking story stays consistent with AppShell.
export default function MobileSheet({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;
    // Stop the page scrolling behind the sheet — on a phone that reads as the sheet
    // being broken rather than as a background scroll.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 z-40 cursor-pointer bg-black/50 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-slate-200 bg-white px-4 pt-3"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-2xl text-sm font-semibold text-slate-500"
          >
            Close
          </button>
        </div>
        <div className="space-y-3">{children}</div>
      </div>
    </div>
  );
}
