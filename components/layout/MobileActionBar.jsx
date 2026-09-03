"use client";

// A bottom-pinned action bar for phone-sized screens.
//
// Field staff open a screen to *do* something — book an order, dispatch it, collect cash —
// but the ops layouts render stats and metadata first, pushing the action below the fold.
// This keeps the action in the thumb zone and visible the moment a screen opens.
//
// Room for the bar is reserved by AppShell's <main> bottom padding, not by a spacer here:
// the bar is not always the last element on a page, so a bundled spacer would land
// mid-content and leave the real last rows hidden behind the bar.
//
// z-30 is deliberate: it matches AppShell's sticky header and sits below the nav drawer
// overlay (z-40) and sidebar (z-50), so opening the nav correctly covers the bar rather
// than the bar floating over the menu.
//
// lg:hidden matches AppShell's existing mobile breakpoint (its drawer is lg:hidden) rather
// than introducing a second breakpoint story.

export default function MobileActionBar({ children, notice, className = "" }) {
  if (!children) return null;
  return (
    <div
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 pt-3 backdrop-blur lg:hidden ${className}`}
        // The iOS home indicator sits inside the viewport; without this the last few
        // pixels of a button are unreachable. max() keeps normal padding on devices
        // that report no inset.
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        {notice ? <div className="mb-2">{notice}</div> : null}
        <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

// Shared button styling so every bar action clears the 44px touch-target minimum.
export const BAR_ACTION_BASE =
  "inline-flex min-h-[44px] flex-1 cursor-pointer items-center justify-center rounded-2xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";

export const BAR_ACTION_PRIMARY = `${BAR_ACTION_BASE} bg-[#1a1b2e] text-white`;

export const BAR_ACTION_SECONDARY = `${BAR_ACTION_BASE} border border-slate-200 bg-white text-slate-600`;

// Destructive actions are deliberately not flex-1: they stay narrower than the primary so
// a mis-tap in the thumb zone does not cancel an order.
export const BAR_ACTION_DANGER =
  "inline-flex min-h-[44px] shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-600 transition disabled:cursor-not-allowed disabled:opacity-60";
