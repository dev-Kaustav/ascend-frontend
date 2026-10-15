"use client";

import { CircleAlert, RefreshCw } from "lucide-react";

export default function FieldFeedback({ loading = false, label = "Loading your workspace…", error, onRetry }) {
  if (loading) {
    return <div role="status" aria-label={label} className="space-y-4">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="h-44 rounded-3xl border border-slate-200 bg-slate-100" />
      <div aria-hidden="true" className="grid grid-cols-3 gap-3">{[1, 2, 3].map((key) => <div key={key} className="h-24 rounded-2xl border border-slate-200 bg-white" />)}</div>
      <div aria-hidden="true" className="h-32 rounded-2xl border border-slate-200 bg-white" />
    </div>;
  }
  return <div role="alert" className="rounded-2xl border border-rose-200 bg-white p-5">
    <CircleAlert className="size-6 text-rose-600" aria-hidden="true" />
    <h2 className="mt-3 text-lg font-semibold">Unable to load this screen</h2>
    <p className="mt-2 text-sm text-slate-600">{error}</p>
    <button type="button" onClick={onRetry || (() => window.location.reload())} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white"><RefreshCw className="size-4" aria-hidden="true" />Try again</button>
  </div>;
}
