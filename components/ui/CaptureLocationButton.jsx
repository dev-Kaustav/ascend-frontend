"use client";

import { useState } from "react";
import { Check, Crosshair, LoaderCircle, RotateCcw } from "lucide-react";
import { formatAccuracy, getCoords } from "@/lib/geo";

// Used wherever someone standing at a shop records where that shop is. Three states, because
// the honest answer to "did it work?" has three shapes: not yet, got it (and how precise), or
// it failed and here is what to do about it.
//
// Sized for a thumb in a market, not a cursor: 48px tall, full width on a phone, and the
// captured state stays tappable so a bad fix taken inside the shop can be retaken at the door.
export default function CaptureLocationButton({
  value,
  onCapture,
  onClear,
  idleLabel = "Capture location",
  capturedLabel = "Location captured",
  hint = "Stand at the shop door for the most accurate pin.",
  className = "",
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const captured = value?.latitude != null && value?.longitude != null;

  async function capture() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      onCapture(await getCoords());
    } catch (err) {
      setError(err?.message || "Couldn't get your location. Try again.");
    } finally {
      setPending(false);
    }
  }

  const accuracy = formatAccuracy(value?.accuracy_m);

  return (
    <div className={`space-y-2 ${className}`}>
      <button
        type="button"
        onClick={capture}
        disabled={pending}
        aria-live="polite"
        className={
          captured
            ? "flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 disabled:opacity-60"
            : "flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#7c3aed]/30 bg-[#7c3aed]/[0.06] px-4 text-sm font-semibold text-[#6d28d9] transition-colors hover:bg-[#7c3aed]/[0.12] disabled:opacity-60"
        }
      >
        {pending ? (
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
        ) : captured ? (
          <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
        ) : (
          <Crosshair className="h-4 w-4" strokeWidth={2.5} aria-hidden />
        )}
        {pending ? "Getting location…" : captured ? capturedLabel : idleLabel}
      </button>

      {captured ? (
        <div className="flex items-center justify-between gap-2 px-1">
          {/* Six decimals is ~0.1 m — enough to tell two adjacent shopfronts apart, and short
              enough to read back over a phone call when someone disputes a pin. */}
          <span className="font-mono text-[11px] tabular-nums text-slate-500">
            {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}
            {accuracy ? <span className="ml-1.5 text-slate-400">{accuracy}</span> : null}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={capture}
              disabled={pending}
              className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-slate-500 underline underline-offset-2 hover:text-slate-700"
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              Retake
            </button>
            {onClear ? (
              <button
                type="button"
                onClick={() => { onClear(); setError(""); }}
                className="cursor-pointer text-[11px] font-semibold text-slate-400 underline underline-offset-2 hover:text-slate-600"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="px-1 text-[11px] text-slate-500">{hint}</p>
      )}

      {error ? (
        <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}
