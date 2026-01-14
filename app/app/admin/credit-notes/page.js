"use client";

import { useEffect, useMemo, useState } from "react";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import StatCard from "@/components/layout/StatCard";
import SectionCard from "@/components/layout/SectionCard";
import DataTable from "@/components/tables/DataTable";

function getCreditNoteAmount(note) {
  if (note.amount !== undefined) return note.amount || 0;
  if (!note.items) return 0;
  return note.items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unit_price || 0), 0);
}

export default function AdminCreditNotes() {
  const [creditNotes, setCreditNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await apiFetch(apiEndpoints.admin.accountingCredits);
        if (!active) return;
        setCreditNotes(response || []);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Unable to load credit notes.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadDetail() {
      if (!selectedNote) return;
      setDetailLoading(true);
      try {
        const response = await apiFetch(apiEndpoints.creditNotes.view(selectedNote.id));
        if (!active) return;
        setDetail(response);
      } catch (err) {
        if (!active) return;
        setDetail(null);
      } finally {
        if (active) setDetailLoading(false);
      }
    }
    loadDetail();
    return () => {
      active = false;
    };
  }, [selectedNote]);

  const totals = useMemo(() => {
    const totalValue = creditNotes.reduce((sum, note) => sum + getCreditNoteAmount(note), 0);
    return { totalValue };
  }, [creditNotes]);

  const columns = useMemo(
    () => [
      {
        header: "Credit Note #",
        accessorKey: "credit_note_number",
        cell: ({ row }) => row.original.credit_note_number || row.original.id
      },
      {
        header: "Order ID",
        accessorKey: "order_id",
        cell: ({ row }) => `#${row.original.order_id}`
      },
      {
        header: "Amount",
        accessorKey: "amount",
        cell: ({ row }) => formatCurrency(getCreditNoteAmount(row.original))
      },
      {
        header: "Date",
        accessorKey: "created_at",
        cell: ({ row }) => formatDate(row.original.created_at)
      }
    ],
    []
  );

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
        Loading credit notes…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-600">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <StatCard
          title="Credit Notes"
          value={formatNumber(creditNotes.length)}
          subtitle="Issued credits"
          accent="sky"
        />
        <StatCard
          title="Total Value"
          value={formatCurrency(totals.totalValue)}
          subtitle="Estimated credit value"
          accent="amber"
        />
        <StatCard
          title="Open Selection"
          value={selectedNote ? selectedNote.credit_note_number || selectedNote.id : "None"}
          subtitle="Click a row to view"
          accent="emerald"
        />
      </div>

      <SectionCard title="Credit Notes" subtitle="Select a credit note to view totals">
        <DataTable
          columns={columns}
          data={creditNotes}
          emptyLabel="No credit notes available."
          onRowClick={(note) => setSelectedNote(note)}
        />
      </SectionCard>

      <SectionCard title="Credit Note Detail" subtitle="Taxable value and totals">
        {detailLoading ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-400">
            Loading credit note detail…
          </div>
        ) : detail ? (
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400">Taxable Value</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{formatCurrency(detail.taxable_value)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400">GST</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{formatCurrency(detail.gst_amount)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400">Subtotal</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{formatCurrency(detail.subtotal)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400">Grand Total</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{formatCurrency(detail.grand_total)}</p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-400">
            Select a credit note to view totals.
          </div>
        )}
      </SectionCard>
    </div>
  );
}
