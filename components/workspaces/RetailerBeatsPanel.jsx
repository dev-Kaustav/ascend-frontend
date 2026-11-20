"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import SectionCard from "@/components/layout/SectionCard";
import DataTable from "@/components/tables/DataTable";
import { AddRowButton, InlineSelect, InlineText, RowActions } from "@/components/tables/InlineRowCells";
import Pager from "@/components/tables/Pager";
import SearchSelect from "@/components/ui/SearchSelect";
import { useBeats } from "@/components/shops/BeatList";
import useAdminLookups from "@/lib/hooks/useAdminLookups";
import useInlineRowEditor from "@/lib/hooks/useInlineRowEditor";
import useShops, { useShopsChanged } from "@/lib/hooks/useShops";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { queryPath } from "@/lib/query";

// The beats at the desk: each with its warehouse, how many shops and what they owe (the server's
// figures). A beat opens in place to its shops, a page at a time; a shop's name opens the shop.

const MEMBERS_PAGE = 20;

function Owed({ amount }) {
  return <span className={`tabular-nums ${amount > 0 ? "font-semibold text-[#5e0b26]" : "text-muted"}`}>{amount > 0 ? formatCurrency(amount) : "—"}</span>;
}

const retailerColumns = [
  { header: "Retailer", accessorKey: "name", meta: { mobilePrimary: true }, cell: ({ row }) => <Link href={`/app/retailers/${row.original.id}`} className="font-medium text-ink hover:underline">{row.original.name}</Link> },
  { header: "Address", accessorKey: "address_line1", cell: ({ row }) => [row.original.address_line1, row.original.city].filter(Boolean).join(", ") || "—" },
  { header: "Salesman", accessorKey: "salesman_name", meta: { align: "center" }, cell: ({ row }) => row.original.salesman_name || "Unassigned" },
  { header: "Owed", accessorKey: "outstanding", meta: { type: "number" }, cell: ({ row }) => <Owed amount={row.original.outstanding} /> }
];

function BeatRetailers({ beat }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const { shops, total } = useShops({ beatId: beat.id ?? "none", page, pageSize: MEMBERS_PAGE });
  return (
    <section aria-label={`Retailers in ${beat.name}`} className="border-t border-line bg-raised/40 pb-3">
      <DataTable columns={retailerColumns} data={shops} onRowClick={(shop) => router.push(`/app/retailers/${shop.id}`)} emptyLabel="No retailers in this beat yet." tableClassName="!min-w-0 table-fixed [&_td]:break-words" mobileCardClassName="!rounded-lg !shadow-none" />
      <Pager page={page} pageSize={MEMBERS_PAGE} total={total} noun="shops" onChange={setPage} />
      {beat.id == null ? null : adding ? <AddToBeat beat={beat} onDone={() => setAdding(false)} /> : <div className="mt-3 px-3"><AddRowButton label="+ Add retailer" onClick={() => setAdding(true)} /></div>}
    </section>
  );
}

// Picking a shop to move onto the beat searches every shop, so the full list is fetched only once
// this picker opens.
function AddToBeat({ beat, onDone }) {
  const { retailers, beats } = useAdminLookups({ errorMessage: "Unable to load retailers." });
  const shopsChanged = useShopsChanged();
  const [retailerId, setRetailerId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
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
      await shopsChanged();
      onDone();
    } catch (err) {
      setError(err?.message || "Unable to add retailer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={addRetailer} aria-label={`Add retailer to ${beat.name}`} className="border-t border-line px-3 pt-3">
      <div className="flex flex-wrap items-start gap-2">
        <SearchSelect value={retailerId} onChange={setRetailerId} options={options} ariaLabel="Find retailer" placeholder="Search retailer name, phone or area" emptyLabel="No matching retailers outside this beat." disabled={saving} className="min-w-0 basis-full sm:flex-1 sm:basis-0" inputClassName="!min-h-11 !rounded-md !border-control" />
        <button type="submit" disabled={!selected || saving} className="min-h-11 rounded-md bg-ink px-4 text-sm font-medium text-white disabled:opacity-40">{saving ? "Adding…" : selected?.beat_id ? "Move here" : "Add"}</button>
        <button type="button" disabled={saving} onClick={onDone} className="min-h-11 rounded-md border border-control bg-white px-3 text-sm text-ink disabled:opacity-40">Cancel</button>
      </div>
      {selected?.beat_id ? <p className="mt-2 text-sm text-muted">Moves {selected.name} from {beats.find((item) => item.id === selected.beat_id)?.name || "their current beat"} to {beat.name}.</p> : null}
      {error ? <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p> : null}
    </form>
  );
}

export default function RetailerBeatsPanel() {
  const { data: beats, error, isPending } = useBeats();
  const { data: warehouses = [] } = useQuery({ queryKey: queryPath(apiEndpoints.admin.warehouses), staleTime: 60_000 });
  const shopsChanged = useShopsChanged();
  // Expanded beats by key: the beat's id, or "none" for the shops on no beat.
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
    onSaved: shopsChanged
  });
  const warehouseOptions = warehouses.map((warehouse) => ({ value: String(warehouse.id), label: warehouse.name }));
  const rows = editor.withDraftRow((beats || []).map((beat) => ({
    ...beat,
    warehouse_name: beat.id == null ? "—" : warehouses.find((warehouse) => warehouse.id === beat.warehouse_id)?.name || "Unassigned"
  })));
  const keyOf = (beat) => beat.id ?? "none";
  function toggleBeat(beat) {
    if (beat.__draft || editor.isEditing(beat)) return;
    const key = keyOf(beat);
    setExpanded((current) => current.includes(key) ? current.filter((id) => id !== key) : [...current, key]);
  }
  const columns = [
    {
      header: "Beat",
      accessorKey: "name",
      meta: { mobilePrimary: true },
      cell: ({ row }) => editor.isEditing(row)
        ? <InlineText editor={editor} field="name" label="Beat name" placeholder="Beat name" autoFocus disabled={editor.saving} />
        : <button type="button" aria-expanded={expanded.includes(keyOf(row.original))} onClick={() => toggleBeat(row.original)} className="inline-flex items-center gap-2 rounded text-left font-medium text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"><ChevronDown aria-hidden="true" size={16} className={`shrink-0 transition-transform ${expanded.includes(keyOf(row.original)) ? "" : "-rotate-90"}`} /><span className="break-words">{row.original.name}</span></button>
    },
    {
      header: "Warehouse",
      accessorKey: "warehouse_name",
      meta: { align: "center" },
      cell: ({ row }) => editor.isEditing(row)
        ? <InlineSelect editor={editor} field="warehouse_id" label="Warehouse" options={warehouseOptions} placeholder="Unassigned" />
        : row.original.warehouse_name
    },
    { header: "Shops", accessorKey: "shops", meta: { type: "number" }, cell: ({ row }) => row.original.__draft ? "—" : row.original.shops },
    { header: "Owed", accessorKey: "outstanding", meta: { type: "number" }, cell: ({ row }) => row.original.__draft ? "—" : <Owed amount={row.original.outstanding} /> },
    // The shops on no beat are a row to open, not a beat to edit.
    { header: "", id: "actions", meta: { mobileFullWidth: true }, cell: ({ row }) => row.original.id == null && !row.original.__draft ? null : <RowActions editor={editor} row={row} onEdit={editor.startEdit} /> }
  ];

  if (isPending) return <div className="rounded-lg border border-line bg-white p-6 text-sm text-muted">Loading retailer beats…</div>;
  if (error) return <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error.message || "Unable to load retailer beats."}</p>;

  return (
    <SectionCard title="Retailer beats" subtitle="What each beat's shops owe. Expand a beat to see its shops or add one; edit beat details in the row." actions={<AddRowButton label="+ Add beat" onClick={editor.startCreate} disabled={editor.isActive} />}>
      {editor.error ? <p role="alert" className="mb-3 text-sm text-rose-700">{editor.error}</p> : null}
      <DataTable
        columns={columns}
        data={rows}
        emptyLabel="No beats yet. Add your first beat above."
        onRowClick={toggleBeat}
        tableClassName="!min-w-0 table-fixed [&>thead>tr>th:first-child]:w-2/5 [&>thead>tr>th:nth-child(2)]:w-1/5 [&>thead>tr>th:last-child]:w-20"
        containerClassName="!overflow-visible"
        mobileCardClassName="!rounded-lg !shadow-none"
        renderExpandedRow={(beat) => !beat.__draft && expanded.includes(keyOf(beat)) ? <BeatRetailers beat={beat} /> : null}
      />
    </SectionCard>
  );
}
