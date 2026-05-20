"use client";

import { useState } from "react";
import { apiFetch, apiEndpoints } from "@/lib/api";

function formatTime(d) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

async function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location services aren't available in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
    });
  });
}

export default function MarkDeliveredButton({ outlet, state, onChange, onCoordsUpdated, proximity }) {
  const [pending, setPending] = useState(false);
  const [farConfirm, setFarConfirm] = useState(false);
  const status = state?.status || "idle";
  const isFar = proximity?.isFar ?? false;

  async function submit(confirmOuterLimit) {
    setPending(true);
    onChange({ status: "loading" });
    try {
      const pos = await getPosition();
      const body = {
        retailer_external_id: outlet.external_id,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy_m: pos.coords.accuracy ?? null,
        confirm_outer_limit: Boolean(confirmOuterLimit),
      };
      const data = await apiFetch(apiEndpoints.outletFinder.deliveriesMark, {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (data.requires_confirmation) {
        onChange({
          status: "confirm",
          message: data.message,
          distance_m: data.distance_m,
        });
        return;
      }

      if (data.retailer_updated && data.new_latitude != null && data.new_longitude != null) {
        onCoordsUpdated?.(outlet.external_id, data.new_latitude, data.new_longitude);
      }

      onChange({
        status: "delivered",
        time: new Date().toISOString(),
        retailer_updated: data.retailer_updated,
      });
    } catch (err) {
      const msg =
        err?.message ||
        (typeof err === "string" ? err : "Something went wrong. Try again.");
      onChange({ status: "error", message: msg });
    } finally {
      setPending(false);
    }
  }

  function undo() {
    onChange(null);
  }

  if (status === "delivered") {
    const t = state?.time ? new Date(state.time) : new Date();
    return (
      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800">
          <span aria-hidden className="text-base leading-none">✓</span>
          Delivered at {formatTime(t)}
          {state?.retailer_updated && (
            <span className="text-xs font-medium text-emerald-700/80">· Location updated</span>
          )}
        </span>
        <button
          onClick={undo}
          className="text-xs font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-900 cursor-pointer"
        >
          Undo
        </button>
      </div>
    );
  }

  if (status === "confirm") {
    return (
      <div className="mt-3 space-y-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-3">
        <p className="text-sm text-amber-900">{state.message}</p>
        <div className="flex gap-2">
          <button
            disabled={pending}
            onClick={() => submit(true)}
            className="flex-1 min-h-[44px] rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 active:scale-[0.98] transition-transform disabled:opacity-60 cursor-pointer"
          >
            Yes, deliver here
          </button>
          <button
            disabled={pending}
            onClick={() => onChange(null)}
            className="flex-1 min-h-[44px] rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 active:scale-[0.98] transition-transform disabled:opacity-60 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const distanceM = proximity?.distanceM ?? null;
  let chip;
  if (distanceM == null) {
    chip = (
      <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5">
        Couldn&apos;t check your location — confirm you&apos;re at this shop.
      </p>
    );
  } else if (!isFar) {
    chip = (
      <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1.5">
        You&apos;re ~{Math.round(distanceM)} m away ✓
      </p>
    );
  } else {
    const km = distanceM / 1000;
    const dist = km >= 1 ? `${km.toFixed(1)} km` : `${Math.round(distanceM)} m`;
    chip = (
      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
        You&apos;re {dist} away — make sure this is the right shop.
      </p>
    );
  }

  if (farConfirm) {
    const km = distanceM != null ? distanceM / 1000 : null;
    const dist = km == null ? "the saved location" : km >= 1 ? `${km.toFixed(1)} km from the saved location` : `${Math.round(distanceM)} m from the saved location`;
    return (
      <div className="mt-3 space-y-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-3">
        <p className="text-sm text-amber-900">You&apos;re {dist}. Deliver here?</p>
        <div className="flex gap-2">
          <button
            disabled={pending}
            onClick={() => submit(true)}
            className="flex-1 min-h-[48px] rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 active:scale-[0.98] transition-transform disabled:opacity-60 cursor-pointer"
          >
            Yes, deliver here
          </button>
          <button
            disabled={pending}
            onClick={() => setFarConfirm(false)}
            className="flex-1 min-h-[48px] rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 active:scale-[0.98] transition-transform disabled:opacity-60 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {chip}
      <button
        onClick={() => (isFar ? setFarConfirm(true) : submit(false))}
        disabled={pending}
        className={
          isFar
            ? "w-full min-h-[56px] rounded-xl border-2 border-amber-500 bg-white px-6 py-3 text-base font-semibold text-amber-700 active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
            : "w-full min-h-[56px] rounded-xl bg-emerald-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
        }
      >
        <span aria-hidden className="text-lg leading-none">✓</span>
        {pending ? "Marking…" : isFar ? "Confirm delivery here" : "Mark Delivered"}
      </button>
      {status === "error" && state?.message && (
        <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-2.5 py-1.5">
          {state.message}
        </p>
      )}
    </div>
  );
}
