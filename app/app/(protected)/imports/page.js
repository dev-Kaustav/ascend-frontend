"use client";

import { useEffect, useRef, useState } from "react";
import { apiEndpoints, apiFetch, apiFetchBlob, apiFetchCached, invalidateApiCache } from "@/lib/api";
import SectionCard from "@/components/layout/SectionCard";
import HoverScrollbar from "@/components/ui/HoverScrollbar";

const ENTITY_LABELS = {
  brands:     { label: "Brands",     columns: "Name · POC Name · POC Phone · POC Email" },
  retailers:  { label: "Retailers",  columns: "Name · Mobile · Address · City · State · Pincode · GST · Assigned Salesman" },
  warehouses: { label: "Warehouses", columns: "Name · Location · Address · City · State · Pincode · Manager Name" },
  skus:       { label: "SKUs",       columns: "Name · Brand Name · HSN · MRP · Rate · DLP · Discount · SGST% · CGST% · IGST% · Weight · Dimensions" },
  beats:      { label: "Beats",      columns: "Name · Warehouse Name" },
};

function UploadCloudIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-10 w-10">
      <path d="M12 16V8m0 0-3 3m3-3 3 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0">
      <path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path d="M12 4v12m0 0-4-4m4 4 4-4M4 20h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EntityResultRow({ entity, result }) {
  const info = ENTITY_LABELS[entity];
  const hasErrors = result?.errors?.length > 0;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{info.label}</p>
          <p className="mt-0.5 text-xs text-slate-400">{info.columns}</p>
        </div>
        {hasErrors ? (
          <span className="shrink-0 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600">
            {result.errors.length} error{result.errors.length !== 1 ? "s" : ""}
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <CheckIcon />
            {result.inserted} row{result.inserted !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      {hasErrors && (
        <HoverScrollbar className="mt-3 max-h-32 space-y-1 overflow-y-auto">
          {result.errors.map((e, i) => (
            <p key={i} className="text-xs text-rose-600">Row {e.row}: {e.error}</p>
          ))}
        </HoverScrollbar>
      )}
    </div>
  );
}

function DailySalesImport() {
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [salesFile, setSalesFile] = useState(null);
  const [salesUploading, setSalesUploading] = useState(false);
  const [salesResult, setSalesResult] = useState(null);
  const salesInputRef = useRef(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetchCached(apiEndpoints.admin.lookups);
        setWarehouses(data?.warehouses || []);
      } catch {}
    }
    load();
  }, []);

  async function handleSalesUpload() {
    if (!salesFile || !selectedWarehouse || salesUploading) return;
    setSalesUploading(true);
    setSalesResult(null);
    try {
      const formData = new FormData();
      formData.append("file", salesFile);
      const data = await apiFetch(`${apiEndpoints.imports.dailySales}?warehouse_id=${selectedWarehouse}`, {
        method: "POST",
        body: formData,
      });
      setSalesResult(data);
      if (data.orders_created > 0) {
        setSalesFile(null);
        if (salesInputRef.current) salesInputRef.current.value = "";
      }
    } catch (err) {
      setSalesResult({ _error: err?.message || "Import failed" });
    } finally {
      setSalesUploading(false);
    }
  }

  return (
    <SectionCard title="Import Daily Sales" subtitle="Upload warehouse daily sales Excel workbook">
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
          <p className="mb-3 text-xs font-semibold text-slate-600">Select Warehouse</p>
          <div className="flex flex-wrap gap-2">
            {warehouses.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setSelectedWarehouse(w.id)}
                className={`cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                  selectedWarehouse === w.id
                    ? "bg-[#1a1b2e] text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                {w.name}
              </button>
            ))}
          </div>
        </div>

        <label className="relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center transition-colors hover:border-slate-400">
          <span className="text-slate-300">
            <UploadCloudIcon />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-600">
              {salesFile ? salesFile.name : "Upload daily sales .xlsx"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Accepts DLF (PUC107105) or City (PUC107106) format workbooks
            </p>
          </div>
          <input
            ref={salesInputRef}
            type="file"
            accept=".xlsx"
            onChange={(e) => { setSalesFile(e.target.files?.[0] || null); setSalesResult(null); }}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>

        {salesFile && selectedWarehouse && (
          <button
            type="button"
            onClick={handleSalesUpload}
            disabled={salesUploading}
            className="w-full cursor-pointer rounded-full bg-[#1a1b2e] py-3 text-sm font-semibold text-white transition-opacity hover:bg-[#2a2b3e] disabled:opacity-60"
          >
            {salesUploading ? "Importing daily sales data…" : "Import Daily Sales"}
          </button>
        )}

        {salesResult && !salesResult._error && (
          <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Import Results</p>
            <p className="text-xs text-slate-500">Format detected: <span className="font-semibold text-slate-700">{salesResult.format_detected}</span></p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                { label: "Orders created", value: salesResult.orders_created, color: "emerald" },
                { label: "Payments recorded", value: salesResult.payments_created, color: "emerald" },
                { label: "Recovery entries", value: salesResult.recovery_entries, color: "sky" },
                { label: "Retailers matched", value: salesResult.retailers_matched, color: "sky" },
                { label: "New retailers", value: salesResult.retailers_new, color: "amber" },
                { label: "Errors", value: salesResult.errors?.length || 0, color: salesResult.errors?.length ? "rose" : "emerald" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[11px] uppercase tracking-wider text-slate-400">{s.label}</p>
                  <p className={`mt-1 text-lg font-semibold ${s.color === "rose" ? "text-rose-600" : s.color === "amber" ? "text-amber-600" : "text-slate-900"}`}>
                    {s.value}
                  </p>
                </div>
              ))}
            </div>
            {salesResult.errors?.length > 0 && (
              <HoverScrollbar className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                {salesResult.errors.map((e, i) => (
                  <p key={i} className="text-xs text-rose-600">
                    {e.sheet ? `${e.sheet} row ${e.row}` : `Row ${e.row}`}: {e.error}
                  </p>
                ))}
              </HoverScrollbar>
            )}
          </div>
        )}

        {salesResult?._error && (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {salesResult._error}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

export default function ImportsPage() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const inputRef = useRef(null);

  function handleFileSelect(e) {
    setFile(e.target.files?.[0] || null);
    setResult(null);
  }

  async function handleUpload() {
    if (!file || uploading) return;
    setUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const data = await apiFetch(apiEndpoints.imports.upload, {
        method: "POST",
        body: formData,
      });
      setResult(data);
      // An import creates SKUs, retailers and warehouses; the 5-minute lookups cache
      // would otherwise hide them from every form until it expired.
      invalidateApiCache(apiEndpoints.admin.lookups);
      const anyInserted = Object.values(data).some((r) => r.inserted > 0);
      if (anyInserted) {
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
      }
    } catch (err) {
      setResult({ _error: err?.message || "Upload failed" });
    } finally {
      setUploading(false);
    }
  }

  async function handleTemplate() {
    if (templateLoading) return;
    setTemplateLoading(true);
    try {
      const { blob, filename } = await apiFetchBlob(apiEndpoints.imports.template);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || "ascend_import_template.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setTemplateLoading(false);
    }
  }

  const hasAnyError = result && Object.values(result).some((r) => r?.errors?.length > 0);
  const allSuccess = result && !result._error && !hasAnyError;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Data Imports</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload a single Excel workbook with four sheets: Brands, Retailers, Warehouses, SKUs.
          Data is imported in that order — brands must exist before SKUs can reference them.
        </p>
      </div>

      <SectionCard
        title="Import Workbook"
        subtitle="One .xlsx file · four sheets · first row = headers"
        actions={
          <button
            type="button"
            onClick={handleTemplate}
            disabled={templateLoading}
            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            <DownloadIcon />
            {templateLoading ? "Preparing…" : "Download Template"}
          </button>
        }
      >
        <div className="space-y-4">
          {/* Sheet guide */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Object.entries(ENTITY_LABELS).map(([key, info]) => (
              <div key={key} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold text-slate-700">{info.label}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{info.columns}</p>
              </div>
            ))}
          </div>

          {/* Drop zone */}
          <label className="relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center transition-colors hover:border-accent/40 hover:bg-accent-soft/30">
            <span className="text-slate-300">
              <UploadCloudIcon />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-600">
                {file ? file.name : "Click or drag to upload .xlsx"}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {file ? "File selected — click Import to proceed" : "Excel workbook with Brands, Retailers, Warehouses, SKUs sheets"}
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              onChange={handleFileSelect}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>

          {file && (
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="w-full cursor-pointer rounded-full bg-slate-900 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
            >
              {uploading ? "Importing…" : "Import"}
            </button>
          )}

          {/* Per-entity results */}
          {result && !result._error && (
            <div className="space-y-3">
              {hasAnyError && (
                <p className="text-sm font-semibold text-rose-600">
                  Import failed — fix the errors below and re-upload. Nothing was saved.
                </p>
              )}
              {allSuccess && (
                <p className="text-sm font-semibold text-emerald-700">
                  All sheets imported successfully.
                </p>
              )}
              {Object.entries(result).map(([entity, entityResult]) => (
                <EntityResultRow key={entity} entity={entity} result={entityResult} />
              ))}
            </div>
          )}

          {result?._error && (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {result._error}
            </div>
          )}
        </div>
      </SectionCard>

      <DailySalesImport />
    </div>
  );
}
