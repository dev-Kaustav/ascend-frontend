"use client";

import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";

export default function DataTable({ columns, data, emptyLabel = "No records", onRowClick }) {
  const table = useReactTable({
    data: data || [],
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  return (
    <div className="overflow-x-auto max-w-full">
      <table className="w-full min-w-[720px] border-separate border-spacing-y-2 text-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-400 whitespace-normal break-words"
                >
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-slate-400">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={`rounded-2xl border border-slate-200 bg-white/90 ${
                  onRowClick ? "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-lg" : ""
                }`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 text-slate-600">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
