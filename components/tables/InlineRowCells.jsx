"use client";

import { Check, Pencil, X } from "lucide-react";

// Cells for a row being edited in place. Sized to sit inside a table row without changing its
// height, so switching a row into edit mode never shifts the rows below it.
const CELL_INPUT_CLASSNAME =
  "h-8 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-800 transition-colors placeholder:text-slate-400 focus:border-[#7c3aed] focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/25";

// Enter commits, Escape abandons — the shortcuts a spreadsheet trains people to expect.
function keyHandler(editor) {
  return (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      editor.save();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      editor.cancel();
    }
  };
}

export function InlineText({ editor, field, label, className = "", ...props }) {
  return (
    <input
      type="text"
      // The column header is the visible label, so the input carries its own accessible name.
      aria-label={label}
      value={editor.values[field] ?? ""}
      onChange={(event) => editor.setField(field, event.target.value)}
      onKeyDown={keyHandler(editor)}
      className={`${CELL_INPUT_CLASSNAME} ${className}`}
      {...props}
    />
  );
}

export function InlineNumber({ editor, field, label, digits, className = "", ...props }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={label}
      value={editor.values[field] ?? ""}
      onChange={(event) => {
        const raw = event.target.value;
        editor.setField(field, digits ? raw.replace(/\D/g, "").slice(0, digits) : raw);
      }}
      onKeyDown={keyHandler(editor)}
      className={`${CELL_INPUT_CLASSNAME} text-right tabular-nums ${className}`}
      {...props}
    />
  );
}

export function InlineSelect({ editor, field, label, options, placeholder = "—", className = "" }) {
  return (
    <select
      aria-label={label}
      value={editor.values[field] ?? ""}
      onChange={(event) => editor.setField(field, event.target.value)}
      onKeyDown={keyHandler(editor)}
      className={`${CELL_INPUT_CLASSNAME} ${className}`}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

// Save / cancel while a row is being edited, an Edit affordance otherwise. Rendered in a fixed
// width so the actions column does not resize as rows switch modes.
export function RowActions({ editor, row, onEdit }) {
  if (editor.isEditing(row)) {
    return (
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={editor.save}
          disabled={editor.saving}
          aria-label="Save row"
          title="Save (Enter)"
          className="cursor-pointer rounded-lg bg-slate-900 p-1.5 text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={editor.cancel}
          disabled={editor.saving}
          aria-label="Cancel edit"
          title="Cancel (Esc)"
          className="cursor-pointer rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-end">
      <button
        type="button"
        onClick={() => onEdit(row.original)}
        disabled={editor.isActive}
        aria-label={`Edit ${row.original.name || "row"}`}
        title="Edit"
        className="cursor-pointer rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 disabled:opacity-40"
      >
        <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}

// The button that starts a new row. Sits in the section header beside the other table controls.
export function AddRowButton({ label, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="cursor-pointer rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-slate-700 disabled:opacity-40"
    >
      {label}
    </button>
  );
}
