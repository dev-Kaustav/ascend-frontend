"use client";

import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";

const ALIGN_CLASS = {
  left: "text-left",
  center: "text-center",
  right: "text-right"
};

function resolveAlign(columnDef) {
  const meta = columnDef?.meta || {};
  if (meta.align) return meta.align;
  if (meta.type === "number") return "right";
  return "left";
}

export default function DataTable({
  columns,
  data,
  emptyLabel = "No records",
  onRowClick,
  tableClassName = "",
  containerClassName = ""
}) {
  const table = useReactTable({
    data: data || [],
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  return (
    <div className={`overflow-x-auto max-w-full ${containerClassName}`}>
      <table className={`w-full min-w-[720px] border-separate border-spacing-y-2 text-sm ${tableClassName}`}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const align = resolveAlign(header.column.columnDef);
                return (
                  <th
                    key={header.id}
                    className={`px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 whitespace-normal break-words ${ALIGN_CLASS[align]}`}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-slate-400">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={`rounded-2xl border border-slate-200 bg-white shadow-[0_10px_24px_-20px_rgba(15,23,42,0.35)] ${
                  onRowClick ? "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-24px_rgba(15,23,42,0.35)]" : ""
                }`}
              >
                {row.getVisibleCells().map((cell) => {
                  const align = resolveAlign(cell.column.columnDef);
                  return (
                    <td key={cell.id} className={`px-4 py-3.5 text-slate-600 ${ALIGN_CLASS[align]}`}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
