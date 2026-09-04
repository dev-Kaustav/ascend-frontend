"use client";

import { useCallback, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

export const DRAFT_ROW_ID = "__draft__";

/**
 * Editing state for a table that edits in place rather than through a separate form.
 *
 * One row is editable at a time: either a draft row prepended to the table (create) or an
 * existing row switched to inputs (update). Panels own their columns and payload shape; this
 * owns the state machine and the request.
 *
 * `applyFieldChange` lets a caller derive other fields from the one edited — the catalog passes
 * the shared SKU pricing rules through it so an inline edit recomputes discount, rate and GST
 * exactly as the Quick Create form does.
 */
export default function useInlineRowEditor({
  blank,
  toForm,
  buildBody,
  createUrl,
  updateUrl,
  applyFieldChange,
  onSaved
}) {
  const [mode, setMode] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const startCreate = useCallback(() => {
    setMode("create");
    setEditingId(DRAFT_ROW_ID);
    setValues(blank());
    setError("");
  }, [blank]);

  const startEdit = useCallback(
    (record) => {
      setMode("edit");
      setEditingId(record.id);
      setValues(toForm(record));
      setError("");
    },
    [toForm]
  );

  const cancel = useCallback(() => {
    setMode(null);
    setEditingId(null);
    setValues({});
    setError("");
  }, []);

  const setField = useCallback(
    (field, value) => {
      setValues((prev) => (applyFieldChange ? applyFieldChange(prev, field, value) : { ...prev, [field]: value }));
    },
    [applyFieldChange]
  );

  const save = useCallback(async () => {
    if (!mode || saving) return;
    setSaving(true);
    setError("");
    try {
      const isCreate = mode === "create";
      await apiFetch(isCreate ? createUrl : updateUrl(editingId), {
        method: isCreate ? "POST" : "PATCH",
        body: JSON.stringify(buildBody(values, isCreate))
      });
      // Cancel before refreshing: the row is about to be replaced by server data, and leaving
      // it in edit mode would show stale inputs over the refreshed row.
      setMode(null);
      setEditingId(null);
      setValues({});
      if (onSaved) await onSaved();
    } catch (err) {
      setError(err?.payload?.detail || err?.message || "Unable to save.");
    } finally {
      setSaving(false);
    }
  }, [mode, saving, createUrl, updateUrl, editingId, buildBody, values, onSaved]);

  const isEditing = useCallback(
    (row) => {
      const id = row?.original ? row.original.id : row?.id;
      return editingId !== null && String(id) === String(editingId);
    },
    [editingId]
  );

  // The draft is a real row object so it flows through the existing DataTable untouched.
  const withDraftRow = useCallback(
    (rows) => (mode === "create" ? [{ id: DRAFT_ROW_ID, __draft: true }, ...rows] : rows),
    [mode]
  );

  return useMemo(
    () => ({
      mode,
      values,
      saving,
      error,
      isActive: mode !== null,
      startCreate,
      startEdit,
      cancel,
      setField,
      save,
      isEditing,
      withDraftRow
    }),
    [mode, values, saving, error, startCreate, startEdit, cancel, setField, save, isEditing, withDraftRow]
  );
}
