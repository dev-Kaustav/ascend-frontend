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

function headerLabel(column) {
  const header = column.columnDef.header;
  return typeof header === "string" ? header : column.id;
}

export default function DataTable({
  columns,
  data,
  emptyLabel = "No records",
  onRowClick,
  renderMobileRow,
  tableClassName = "",
  containerClassName = ""
}) {
  const table = useReactTable({
    data: data || [],
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  const rows = table.getRowModel().rows;

  return (
    <>
      {/* Phones get stacked cards. The table is min-w-[720px], so on a ~390px screen every
          list in the app (18 components use this) scrolled sideways. Cards are built from
          the same column definitions, so panels need no per-screen work.

          meta.mobilePrimary marks the headline field (rendered large, no label);
          meta.mobileHidden drops a column that is noise on a small screen. Without either
          hint, every column renders as a label/value row — correct, if verbose. */}
      <div className={renderMobileRow ? "lg:hidden" : "md:hidden"}>
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
            {emptyLabel}
          </div>
        ) : (
          <ul className="space-y-2.5">
            {rows.map((row) => {
              if (renderMobileRow) {
                return <li key={row.id}>{renderMobileRow(row.original, (columnId) => {
                  const cell = row.getVisibleCells().find((item) => item.column.id === columnId);
                  return cell ? flexRender(cell.column.columnDef.cell, cell.getContext()) : null;
                })}</li>;
              }
              const cells = row.getVisibleCells().filter((cell) => !cell.column.columnDef.meta?.mobileHidden);
              const primary = cells.find((cell) => cell.column.columnDef.meta?.mobilePrimary);
              const rest = cells.filter((cell) => cell !== primary);
              return (
                <li key={row.id}>
                  <div
                    onClick={
                      onRowClick
                        ? (event) => {
                            // A card can contain its own buttons and selects (the driver's
                            // status controls live in a cell). Tapping those must not also
                            // open the row.
                            if (event.target.closest("button, a, select, input, textarea, label")) return;
                            onRowClick(row.original);
                          }
                        : undefined
                    }
                    onKeyDown={
                      onRowClick
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onRowClick(row.original);
                            }
                          }
                        : undefined
                    }
                    role={onRowClick ? "button" : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.35)] ${
                      onRowClick ? "cursor-pointer active:bg-slate-50" : ""
                    }`}
                  >
                    {primary ? (
                      <div className="mb-2 text-base font-semibold text-slate-900">
                        {flexRender(primary.column.columnDef.cell, primary.getContext())}
                      </div>
                    ) : null}
                    <dl className="grid grid-cols-[minmax(0,7rem)_1fr] gap-x-3 gap-y-1.5">
                      {rest.filter((cell) => !cell.column.columnDef.meta?.mobileFullWidth).map((cell) => (
                        <div key={cell.id} className="contents">
                          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            {headerLabel(cell.column)}
                          </dt>
                          <dd className="min-w-0 text-sm text-slate-700">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {/* Cells that need the full card width — a driver's status controls
                        are unusable squeezed into a value column. */}
                    {rest
                      .filter((cell) => cell.column.columnDef.meta?.mobileFullWidth)
                      .map((cell) => (
                        <div key={cell.id} className="mt-3 border-t border-slate-100 pt-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className={`hidden overflow-x-auto max-w-full ${renderMobileRow ? "lg:block" : "md:block"} ${containerClassName}`}>
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
    </>
  );
}
