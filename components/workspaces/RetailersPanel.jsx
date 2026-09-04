"use client";

import { useCallback, useMemo, useState } from "react";
import SectionCard from "@/components/layout/SectionCard";
import DataTable from "@/components/tables/DataTable";
import {
  AddRowButton,
  InlineNumber,
  InlineSelect,
  InlineText,
  RowActions
} from "@/components/tables/InlineRowCells";
import { InputBar, SelectBar } from "@/components/ui/InputBars";
import { apiEndpoints } from "@/lib/api";
import { INDIAN_STATES } from "@/lib/states";
import useAdminLookups from "@/lib/hooks/useAdminLookups";
import useInlineRowEditor from "@/lib/hooks/useInlineRowEditor";

const formatPhone = (value) => {
  if (!value && value !== 0) return "—";
  const raw = String(value).replace(/\D/g, "");
  if (raw.length === 10) {
    return `${raw.slice(0, 5)} ${raw.slice(5)}`;
  }
  return raw || "—";
};

const asText = (value) => (value === null || value === undefined ? "" : String(value));
const orNull = (value) => (value === "" || value === undefined ? null : value);
const numOrNull = (value) => (value === "" || value === null || value === undefined ? null : Number(value));

export default function RetailersPanel() {
  // retailers, salesmen and beats all arrive in the one /admin/lookups payload this hook
  // already caches, so listing retailers costs no extra request.
  const { retailers, salesmen, beats, loading, error, refreshLookups } = useAdminLookups({
    errorMessage: "Unable to load retailers."
  });
  const [search, setSearch] = useState("");
  const [salesmanId, setSalesmanId] = useState("");
  const [beatId, setBeatId] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const editor = useInlineRowEditor({
    blank: useCallback(
      () => ({
        name: "",
        mobile_number: "",
        address_line1: "",
        address_line2: "",
        city: "",
        state: "",
        pincode: "",
        gst_number: "",
        assigned_salesman_id: "",
        beat_id: ""
      }),
      []
    ),
    toForm: useCallback(
      (retailer) => ({
        name: asText(retailer.name),
        mobile_number: asText(retailer.mobile_number),
        address_line1: asText(retailer.address_line1),
        address_line2: asText(retailer.address_line2),
        city: asText(retailer.city),
        state: asText(retailer.state),
        pincode: asText(retailer.pincode),
        gst_number: asText(retailer.gst_number),
        assigned_salesman_id: asText(retailer.assigned_salesman_id),
        beat_id: asText(retailer.beat_id)
      }),
      []
    ),
    // RetailerCreate declares its optionals without defaults, so create has to send every key
    // even when null. The update schema is genuinely partial, but sending the full row is
    // correct there too — the form holds the whole record either way.
    buildBody: useCallback(
      (values) => ({
        name: values.name,
        mobile_number: numOrNull(values.mobile_number),
        address_line1: orNull(values.address_line1),
        address_line2: orNull(values.address_line2),
        city: orNull(values.city),
        state: orNull(values.state),
        pincode: numOrNull(values.pincode),
        gst_number: orNull(values.gst_number),
        assigned_salesman_id: numOrNull(values.assigned_salesman_id),
        beat_id: numOrNull(values.beat_id)
      }),
      []
    ),
    createUrl: apiEndpoints.admin.retailers,
    updateUrl: apiEndpoints.admin.retailerUpdate,
    onSaved: refreshLookups
  });

  const salesmanOptions = useMemo(
    () => (salesmen || []).map((salesman) => ({ value: String(salesman.id), label: salesman.name })),
    [salesmen]
  );
  const beatOptions = useMemo(
    () => (beats || []).map((beat) => ({ value: String(beat.id), label: beat.name })),
    [beats]
  );
  const stateOptions = useMemo(() => INDIAN_STATES.map((state) => ({ value: state, label: state })), []);

  const salesmanMap = useMemo(
    () => new Map(salesmanOptions.map((option) => [option.value, option.label])),
    [salesmanOptions]
  );
  const beatMap = useMemo(() => new Map(beatOptions.map((option) => [option.value, option.label])), [beatOptions]);

  const rows = useMemo(
    () =>
      (retailers || []).map((retailer) => ({
        ...retailer,
        salesman_name: salesmanMap.get(String(retailer.assigned_salesman_id)) || "—",
        beat_name: beatMap.get(String(retailer.beat_id)) || "—",
        address: [retailer.address_line1, retailer.address_line2].filter(Boolean).join(", ") || "—"
      })),
    [retailers, salesmanMap, beatMap]
  );

  const filtered = useMemo(() => {
    const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter((row) => {
      if (salesmanId && String(row.assigned_salesman_id) !== salesmanId) return false;
      if (beatId && String(row.beat_id) !== beatId) return false;
      if (!tokens.length) return true;
      const haystack = [row.name, row.city, row.state, row.mobile_number, row.gst_number]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    });
  }, [rows, search, salesmanId, beatId]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  // DataTable renders every row it is handed (core row model only), and this list runs to
  // thousands, so the slice is what keeps the tab responsive.
  const pageRows = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize]
  );

  const columns = useMemo(
    () => [
      {
        header: "Retailer",
        accessorKey: "name",
        meta: { mobilePrimary: true },
        cell: ({ row }) =>
          editor.isEditing(row) ? (
            <InlineText editor={editor} field="name" label="Retailer name" placeholder="Retailer name" autoFocus />
          ) : (
            row.original.name || "—"
          )
      },
      {
        header: "Phone",
        accessorKey: "mobile_number",
        cell: ({ row }) =>
          editor.isEditing(row) ? (
            <InlineNumber editor={editor} field="mobile_number" label="Mobile number" digits={10} placeholder="10 digits" />
          ) : (
            formatPhone(row.original.mobile_number)
          )
      },
      {
        header: "Address",
        accessorKey: "address",
        meta: { mobileHidden: true },
        cell: ({ row }) =>
          editor.isEditing(row) ? (
            <div className="flex gap-1">
              <InlineText editor={editor} field="address_line1" label="Address line 1" placeholder="Line 1" />
              <InlineText editor={editor} field="address_line2" label="Address line 2" placeholder="Line 2" />
            </div>
          ) : (
            row.original.address
          )
      },
      {
        header: "City",
        accessorKey: "city",
        cell: ({ row }) =>
          editor.isEditing(row) ? (
            <InlineText editor={editor} field="city" label="City" placeholder="City" />
          ) : (
            row.original.city || "—"
          )
      },
      {
        header: "State",
        accessorKey: "state",
        cell: ({ row }) =>
          editor.isEditing(row) ? (
            <InlineSelect editor={editor} field="state" label="State" options={stateOptions} placeholder="Select state" />
          ) : (
            row.original.state || "—"
          )
      },
      {
        header: "Pincode",
        accessorKey: "pincode",
        meta: { mobileHidden: true },
        cell: ({ row }) =>
          editor.isEditing(row) ? (
            <InlineNumber editor={editor} field="pincode" label="Pincode" digits={6} placeholder="6 digits" />
          ) : (
            row.original.pincode || "—"
          )
      },
      {
        header: "GST",
        accessorKey: "gst_number",
        meta: { mobileHidden: true },
        cell: ({ row }) =>
          editor.isEditing(row) ? (
            <InlineText editor={editor} field="gst_number" label="GST number" placeholder="GST number" />
          ) : (
            row.original.gst_number || "—"
          )
      },
      {
        header: "Salesman",
        accessorKey: "salesman_name",
        cell: ({ row }) =>
          editor.isEditing(row) ? (
            <InlineSelect
              editor={editor}
              field="assigned_salesman_id"
              label="Assigned salesman"
              options={salesmanOptions}
              placeholder="Unassigned"
            />
          ) : (
            row.original.salesman_name
          )
      },
      {
        header: "Beat",
        accessorKey: "beat_name",
        cell: ({ row }) =>
          editor.isEditing(row) ? (
            <InlineSelect
              editor={editor}
              field="beat_id"
              label="Beat"
              options={beatOptions}
              placeholder="Unassigned"
            />
          ) : (
            row.original.beat_name
          )
      },
      {
        header: "",
        id: "actions",
        cell: ({ row }) => <RowActions editor={editor} row={row} onEdit={editor.startEdit} />
      }
    ],
    [editor, salesmanOptions, beatOptions, stateOptions]
  );

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
        Loading retailers…
      </div>
    );
  }

  if (error) {
    return <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-600">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Retailers"
        subtitle={`${filtered.length} of ${rows.length} retailers`}
        actions={
          <>
            <AddRowButton label="+ Add retailer" onClick={editor.startCreate} disabled={editor.isActive} />
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              aria-label="Rows per page"
              className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500"
            >
              {[25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
          </>
        }
      >
        <div className="mb-3 grid gap-2 md:grid-cols-3">
          <InputBar
            type="text"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search name, city, phone or GST"
          />
          <SelectBar
            value={salesmanId}
            aria-label="Filter by salesman"
            onChange={(event) => {
              setSalesmanId(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All salesmen</option>
            {salesmanOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectBar>
          <SelectBar
            value={beatId}
            aria-label="Filter by beat"
            onChange={(event) => {
              setBeatId(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All beats</option>
            {beatOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectBar>
        </div>
        {editor.error ? (
          <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
            {editor.error}
          </p>
        ) : null}
        <DataTable
          columns={columns}
          data={editor.withDraftRow(pageRows)}
          emptyLabel="No retailers match."
          tableClassName="w-max min-w-[1300px]"
        />
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <span>
            Page {safePage} of {pageCount}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={safePage === 1}
              className="cursor-pointer rounded-full border border-slate-200 px-3 py-1 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
              disabled={safePage >= pageCount}
              className="cursor-pointer rounded-full border border-slate-200 px-3 py-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
