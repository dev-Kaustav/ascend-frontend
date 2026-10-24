"use client";

import { useCallback, useMemo, useState } from "react";
import { MapPin, Pencil, Phone } from "lucide-react";
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

// Phone-sized inputs for the stacked card form: 44px targets, and 16px text so iOS Safari does
// not zoom the page when a field takes focus.
const MOBILE_FIELD = "!h-11 !text-base";

function MobileField({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{label}</span>
      {children}
    </label>
  );
}

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
      [...(retailers || [])].sort((a, b) => {
        // Older records have no creation date; use their insertion IDs as a fallback.
        const dateA = a.created_at ? Date.parse(a.created_at) : 0;
        const dateB = b.created_at ? Date.parse(b.created_at) : 0;
        return dateB - dateA || b.id - a.id;
      }).map((retailer) => ({
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

  // Phones and tablets get their own card instead of the generic label/value stack, which
  // hid the address fields (so a new retailer could not be given one) and ran every retailer
  // to five rows. Not a component: DataTable calls it directly, so it must not use hooks.
  const renderMobileRow = (retailer) => {
    if (editor.isEditing(retailer)) {
      return (
        <div className="space-y-3 rounded-2xl border border-[#7c3aed]/30 bg-[#7c3aed]/[0.03] p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            {retailer.__draft ? "New retailer" : "Edit retailer"}
          </p>
          <MobileField label="Retailer name">
            <InlineText editor={editor} field="name" label="Retailer name" placeholder="Shop name" autoFocus className={MOBILE_FIELD} />
          </MobileField>
          <MobileField label="Phone">
            <InlineNumber editor={editor} field="mobile_number" label="Mobile number" digits={10} placeholder="10 digits" className={`${MOBILE_FIELD} !text-left`} />
          </MobileField>
          <MobileField label="Address line 1">
            <InlineText editor={editor} field="address_line1" label="Address line 1" placeholder="Shop no., street, landmark" className={MOBILE_FIELD} />
          </MobileField>
          <MobileField label="Address line 2">
            <InlineText editor={editor} field="address_line2" label="Address line 2" placeholder="Area, locality (optional)" className={MOBILE_FIELD} />
          </MobileField>
          <div className="grid grid-cols-2 gap-3">
            <MobileField label="City">
              <InlineText editor={editor} field="city" label="City" placeholder="City" className={MOBILE_FIELD} />
            </MobileField>
            <MobileField label="Pincode">
              <InlineNumber editor={editor} field="pincode" label="Pincode" digits={6} placeholder="6 digits" className={`${MOBILE_FIELD} !text-left`} />
            </MobileField>
          </div>
          <MobileField label="State">
            <InlineSelect editor={editor} field="state" label="State" options={stateOptions} placeholder="Select state" className={MOBILE_FIELD} />
          </MobileField>
          <MobileField label="GST number">
            <InlineText editor={editor} field="gst_number" label="GST number" placeholder="Optional" className={MOBILE_FIELD} />
          </MobileField>
          <div className="grid grid-cols-2 gap-3">
            <MobileField label="Salesman">
              <InlineSelect editor={editor} field="assigned_salesman_id" label="Assigned salesman" options={salesmanOptions} placeholder="Unassigned" className={MOBILE_FIELD} />
            </MobileField>
            <MobileField label="Beat">
              <InlineSelect editor={editor} field="beat_id" label="Beat" options={beatOptions} placeholder="Unassigned" className={MOBILE_FIELD} />
            </MobileField>
          </div>
          {editor.error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{editor.error}</p>
          ) : null}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={editor.save}
              disabled={editor.saving || !(editor.values.name || "").trim()}
              className="h-11 flex-1 cursor-pointer rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-40"
            >
              {editor.saving ? "Saving…" : retailer.__draft ? "Add retailer" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={editor.cancel}
              disabled={editor.saving}
              className="h-11 cursor-pointer rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </div>
      );
    }
    const place = [retailer.address_line1, retailer.address_line2, retailer.city, retailer.state, retailer.pincode]
      .filter(Boolean)
      .join(", ");
    const phone = formatPhone(retailer.mobile_number);
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">{retailer.name || "—"}</p>
            {place ? (
              <p className="mt-0.5 flex items-start gap-1.5 text-sm text-slate-500">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                <span className="line-clamp-2">{place}</span>
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-amber-600">No address</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => editor.startEdit(retailer)}
            disabled={editor.isActive}
            aria-label={`Edit ${retailer.name || "retailer"}`}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-40"
          >
            <Pencil className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          {phone !== "—" ? (
            <a href={`tel:${retailer.mobile_number}`} className="inline-flex min-h-8 items-center gap-1 font-semibold text-slate-700">
              <Phone className="h-3.5 w-3.5" strokeWidth={2} />
              <span className="tabular-nums">{phone}</span>
            </a>
          ) : null}
          <span>{retailer.salesman_name === "—" ? "No salesman" : retailer.salesman_name}</span>
          <span aria-hidden="true">·</span>
          <span>{retailer.beat_name === "—" ? "No beat" : retailer.beat_name}</span>
          {retailer.gst_number ? <span className="font-mono">{retailer.gst_number}</span> : null}
        </div>
      </div>
    );
  };

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
        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-3">
          <InputBar
            className="col-span-2 md:col-span-1"
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
          // Phones show the error inside the card form instead.
          <p className="mb-3 hidden rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600 lg:block">
            {editor.error}
          </p>
        ) : null}
        <DataTable
          columns={columns}
          data={editor.withDraftRow(pageRows)}
          emptyLabel="No retailers match."
          renderMobileRow={renderMobileRow}
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
