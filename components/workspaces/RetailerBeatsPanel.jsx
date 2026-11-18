"use client";

import { useCallback, useState } from "react";
import { ChevronDown } from "lucide-react";
import SectionCard from "@/components/layout/SectionCard";
import DataTable from "@/components/tables/DataTable";
import { AddRowButton, InlineSelect, InlineText, RowActions } from "@/components/tables/InlineRowCells";
import SearchSelect from "@/components/ui/SearchSelect";
import useAdminLookups from "@/lib/hooks/useAdminLookups";
import useInlineRowEditor from "@/lib/hooks/useInlineRowEditor";
import { apiEndpoints, apiFetch } from "@/lib/api";

const retailerColumns = [
  { header: "Retailer", accessorKey: "name", meta: { mobilePrimary: true } },
  { header: "Address", accessorKey: "address", cell: ({ row }) => row.original.address || "—" },
  { header: "Salesman", accessorKey: "salesman_name", meta: { align: "center" } },
  { header: "Phone", accessorKey: "mobile_number", meta: { align: "right" }, cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{row.original.mobile_number || "—"}</span> }
];

function BeatRetailers({ beat, retailers, beats, salesmen, onSaved }) {
  const [adding, setAdding] = useState(false);
  const [retailerId, setRetailerId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const members = retailers.filter((retailer) => retailer.beat_id === beat.id).map((retailer) => ({
    ...retailer,
    address: [retailer.address_line1, retailer.address_line2].filter(Boolean).join(", "),
    salesman_name: salesmen.find((salesman) => salesman.id === retailer.assigned_salesman_id)?.name || "Unassigned"
  }));
  const selected = retailers.find((retailer) => String(retailer.id) === retailerId);
  const options = retailers.filter((retailer) => retailer.beat_id !== beat.id).map((retailer) => ({
    value: String(retailer.id),
    label: retailer.name,
    keywords: [retailer.mobile_number, retailer.city, retailer.address_line1],
    hint: [retailer.city, retailer.mobile_number, retailer.beat_id
      ? `In ${beats.find((item) => item.id === retailer.beat_id)?.name || "another beat"}`
      : "No beat"].filter(Boolean).join(" · ")
  }));

  async function addRetailer(event) {
    event.preventDefault();
    if (!selected || saving) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch(`${apiEndpoints.admin.retailers}/${retailerId}/beat`, {
        method: "PATCH",
        body: JSON.stringify({ beat_id: beat.id })
      });
      await onSaved();
      setAdding(false);
      setRetailerId("");
    } catch (err) {
      setError(err?.message || "Unable to add retailer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label={`Retailers in ${beat.name}`} className="border-t border-line bg-raised/40 pb-3">
      <DataTable columns={retailerColumns} data={members} emptyLabel="No retailers in this beat yet." tableClassName="!min-w-0 table-fixed [&_td]:break-words" mobileCardClassName="!rounded-lg !shadow-none" />
      {adding ? <form onSubmit={addRetailer} aria-label={`Add retailer to ${beat.name}`} className="border-t border-line px-3 pt-3">
        <div className="flex flex-wrap items-start gap-2">
          <SearchSelect value={retailerId} onChange={setRetailerId} options={options} ariaLabel="Find retailer" placeholder="Search retailer name, phone or area" emptyLabel="No matching retailers outside this beat." disabled={saving} className="min-w-0 basis-full sm:flex-1 sm:basis-0" inputClassName="!min-h-11 !rounded-md !border-control" />
          <button type="submit" disabled={!selected || saving} className="min-h-11 rounded-md bg-ink px-4 text-sm font-medium text-white disabled:opacity-40">{saving ? "Adding…" : selected?.beat_id ? "Move here" : "Add"}</button>
          <button type="button" disabled={saving} onClick={() => { setAdding(false); setRetailerId(""); setError(""); }} className="min-h-11 rounded-md border border-control bg-white px-3 text-sm text-ink disabled:opacity-40">Cancel</button>
        </div>
        {selected?.beat_id ? <p className="mt-2 text-sm text-muted">Moves {selected.name} from {beats.find((item) => item.id === selected.beat_id)?.name || "their current beat"} to {beat.name}.</p> : null}
        {error ? <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p> : null}
      </form> : <div className="mt-3 px-3"><AddRowButton label="+ Add retailer" onClick={() => setAdding(true)} /></div>}
    </section>
  );
}

export default function RetailerBeatsPanel() {
  const { beats, retailers, warehouses, salesmen, loading, error, refreshLookups } = useAdminLookups({ errorMessage: "Unable to load retailer beats." });
  const [expanded, setExpanded] = useState([]);
  const editor = useInlineRowEditor({
    blank: useCallback(() => ({ name: "", warehouse_id: "" }), []),
    toForm: useCallback((beat) => ({ name: beat.name, warehouse_id: beat.warehouse_id == null ? "" : String(beat.warehouse_id) }), []),
    buildBody: useCallback((values) => {
      if (!values.name.trim()) throw new Error("Beat name is required.");
      return { name: values.name.trim(), warehouse_id: values.warehouse_id ? Number(values.warehouse_id) : null };
    }, []),
    createUrl: apiEndpoints.admin.beats,
    updateUrl: (id) => `${apiEndpoints.admin.beats}/${id}`,
    onSaved: refreshLookups
  });
  const warehouseOptions = warehouses.map((warehouse) => ({ value: String(warehouse.id), label: warehouse.name }));
  const rows = editor.withDraftRow(beats.map((beat) => ({
    ...beat,
    warehouse_name: warehouses.find((warehouse) => warehouse.id === beat.warehouse_id)?.name || "Unassigned",
    retailer_count: retailers.filter((retailer) => retailer.beat_id === beat.id).length
  })));
  function toggleBeat(beat) {
    if (beat.__draft || editor.isEditing(beat)) return;
    setExpanded((current) => current.includes(beat.id) ? current.filter((id) => id !== beat.id) : [...current, beat.id]);
  }
  const columns = [
    {
      header: "Beat",
      accessorKey: "name",
      meta: { mobilePrimary: true },
      cell: ({ row }) => editor.isEditing(row)
        ? <InlineText editor={editor} field="name" label="Beat name" placeholder="Beat name" autoFocus disabled={editor.saving} />
        : <button type="button" aria-expanded={expanded.includes(row.original.id)} onClick={() => toggleBeat(row.original)} className="inline-flex items-center gap-2 rounded text-left font-medium text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"><ChevronDown aria-hidden="true" size={16} className={`shrink-0 transition-transform ${expanded.includes(row.original.id) ? "" : "-rotate-90"}`} /><span className="break-words">{row.original.name}</span></button>
    },
    {
      header: "Warehouse",
      accessorKey: "warehouse_name",
      meta: { align: "center" },
      cell: ({ row }) => editor.isEditing(row)
        ? <InlineSelect editor={editor} field="warehouse_id" label="Warehouse" options={warehouseOptions} placeholder="Unassigned" />
        : row.original.warehouse_name
    },
    { header: "Retailers", accessorKey: "retailer_count", meta: { type: "number" }, cell: ({ row }) => row.original.__draft ? "—" : row.original.retailer_count },
    { header: "", id: "actions", meta: { mobileFullWidth: true }, cell: ({ row }) => <RowActions editor={editor} row={row} onEdit={editor.startEdit} /> }
  ];

  if (loading) return <div className="rounded-lg border border-line bg-white p-6 text-sm text-muted">Loading retailer beats…</div>;
  if (error) return <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</p>;

  return (
    <SectionCard title="Retailer beats" subtitle="Expand a beat to view or add retailers. Edit beat details directly in the row." actions={<AddRowButton label="+ Add beat" onClick={editor.startCreate} disabled={editor.isActive} />}>
      {editor.error ? <p role="alert" className="mb-3 text-sm text-rose-700">{editor.error}</p> : null}
      <DataTable
        columns={columns}
        data={rows}
        emptyLabel="No beats yet. Add your first beat above."
        onRowClick={toggleBeat}
        tableClassName="!min-w-0 table-fixed [&>thead>tr>th:first-child]:w-1/2 [&>thead>tr>th:nth-child(2)]:w-1/4 [&>thead>tr>th:last-child]:w-20"
        containerClassName="!overflow-visible"
        mobileCardClassName="!rounded-lg !shadow-none"
        renderExpandedRow={(beat) => expanded.includes(beat.id) ? <BeatRetailers beat={beat} retailers={retailers} beats={beats} salesmen={salesmen} onSaved={refreshLookups} /> : null}
      />
    </SectionCard>
  );
}
