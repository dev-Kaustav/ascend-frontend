"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { acquireHistoryEntry, historyEntry, releaseHistoryEntry } from "@/lib/store/sheet-history";

// The dialog mechanics the shop and address sheets share, the same contract as the login sheet:
// a portal into .ascend-storefront with every other child of that root made inert, page scroll
// locked, one history entry so Back closes it, Escape closes it, Tab stays inside, and focus goes
// back to whatever opened it. The content scrolls inside the sheet, never behind it.

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * title/titleId: the visible heading and the id that labels the dialog.
 * onDismiss: Escape, Back and the close control all call it, once.
 * footer: optional content fixed under a body that scrolls on its own (the cart's totals).
 * backdropClass: extra class on the backdrop (the cart is a side drawer on wide screens).
 */
export default function SheetFrame({ title, titleId, closeLabel, onDismiss, children, className = "", backdropClass = "", footer = null }) {
  const [host] = useState(() => {
    if (typeof document === "undefined") return null;
    const element = document.createElement("div");
    element.className = "store-sheet-host";
    return element;
  });
  const dialogRef = useRef(null);
  const dismissRef = useRef(onDismiss);
  // The latest handler, without re-running the listeners below each time the parent re-renders.
  useEffect(() => {
    dismissRef.current = onDismiss;
  });
  const openRef = useRef(true);

  // The host lives inside .ascend-storefront so the sheet inherits the storefront styles, while
  // everything else in that root can be made inert behind it. Declared first so it runs before the
  // effects below, which need the host in the document.
  useEffect(() => {
    if (!host) return undefined;
    const root = document.querySelector(".ascend-storefront") || document.body;
    root.appendChild(host);
    return () => {
      host.remove();
    };
  }, [host]);

  useEffect(() => {
    if (!host) return undefined;
    const trigger = document.activeElement;
    const root = host.parentElement;
    const inerted = [];
    for (const child of Array.from(root.children)) {
      if (child !== host && !child.hasAttribute("inert")) {
        child.setAttribute("inert", "");
        inerted.push(child);
      }
    }
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    acquireHistoryEntry();
    (dialogRef.current?.querySelector("[data-autofocus]") || dialogRef.current?.querySelector(FOCUSABLE))?.focus();

    return () => {
      for (const child of inerted) child.removeAttribute("inert");
      document.documentElement.style.overflow = previousOverflow;
      releaseHistoryEntry();
      if (trigger && trigger.isConnected && typeof trigger.focus === "function") trigger.focus();
    };
  }, [host]);

  useEffect(() => {
    if (!host) return undefined;
    openRef.current = true; // Strict Mode re-runs this after its simulated unmount
    const dismiss = () => {
      if (!openRef.current) return;
      openRef.current = false;
      dismissRef.current?.();
    };
    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const items = [...dialogRef.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!dialogRef.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    function onPopState() {
      // The browser already removed our entry.
      historyEntry.open = false;
      dismiss();
    }
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("popstate", onPopState);
      openRef.current = false;
    };
  }, [host]);

  if (!host) return null;

  return createPortal(
    <div className={`store-sheet-backdrop ${backdropClass}`}>
      <div ref={dialogRef} className={`store-sheet store-sheet--form ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="store-sheet__head">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="store-sheet__close"
            onClick={() => {
              if (!openRef.current) return;
              openRef.current = false;
              dismissRef.current?.();
            }}
            aria-label={closeLabel}
          >
            <X size={22} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        <div className="store-sheet__body">{children}</div>
        {footer ? <div className="store-sheet__foot">{footer}</div> : null}
      </div>
    </div>,
    host
  );
}
