"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

// Type-to-filter replacement for a native <select> whose option list is too long to scroll.
// Filtering is client-side over options already in memory; swap the memo for a debounced
// fetch if a list ever outgrows what the form downloads up front.

// 16px on phones so iOS Safari does not zoom the page in on focus; 14px from md up.
// See the note on the same constant in components/ui/InputBars.jsx.
const BASE_BAR_CLASSNAME =
  "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-base md:text-sm text-slate-700 transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-[#7c3aed] focus:outline-none focus:ring-1 focus:ring-[#7c3aed]/30";

function matchesQuery(option, tokens) {
  if (!tokens.length) return true;
  const haystack = [option.label, ...(option.keywords || [])]
    .filter((part) => part !== null && part !== undefined && part !== "")
    .join(" ")
    .toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

// Bolds the first occurrence of the query inside the label so the reason a row matched is visible.
function highlight(label, query) {
  if (!query) return label;
  const index = label.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return label;
  return (
    <>
      {label.slice(0, index)}
      <mark className="bg-transparent font-semibold text-slate-900">
        {label.slice(index, index + query.length)}
      </mark>
      {label.slice(index + query.length)}
    </>
  );
}

export default function SearchSelect({
  value,
  onChange,
  options,
  placeholder = "Search…",
  emptyLabel = "No matches",
  disabled = false,
  className = "",
  inputClassName = "",
  maxResults = 100
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const instanceId = useId();

  const selected = useMemo(
    () => options.find((option) => String(option.value) === String(value)) || null,
    [options, value]
  );

  const matches = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return options.filter((option) => matchesQuery(option, tokens));
  }, [options, query]);
  const visible = matches.slice(0, maxResults);

  // Closed: show the selection. Open: show what is being typed.
  const displayValue = open ? query : selected?.label || "";

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  // Keep the keyboard-highlighted row inside the scrollable panel.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const node = listRef.current.querySelector(`[data-index="${highlightIndex}"]`);
    if (node) node.scrollIntoView({ block: "nearest" });
  }, [highlightIndex, open]);

  const commit = (option) => {
    onChange(option ? String(option.value) : "");
    setQuery("");
    setOpen(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setHighlightIndex(0);
        return;
      }
      if (!visible.length) return;
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setHighlightIndex((prev) => (prev + delta + visible.length) % visible.length);
      return;
    }
    if (event.key === "Enter") {
      if (!open) return;
      event.preventDefault();
      if (visible[highlightIndex]) commit(visible[highlightIndex]);
      return;
    }
    if (event.key === "Escape") {
      if (!open) return;
      event.preventDefault();
      setOpen(false);
      setQuery("");
      return;
    }
    if (event.key === "Tab" && open) {
      setOpen(false);
      setQuery("");
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${instanceId}-listbox`}
        aria-autocomplete="list"
        aria-activedescendant={open && visible[highlightIndex] ? `${instanceId}-option-${highlightIndex}` : undefined}
        autoComplete="off"
        disabled={disabled}
        value={displayValue}
        placeholder={selected ? selected.label : placeholder}
        onChange={(event) => {
          setQuery(event.target.value);
          setHighlightIndex(0);
          if (!open) setOpen(true);
        }}
        onFocus={(event) => {
          setOpen(true);
          setHighlightIndex(0);
          event.target.select();
        }}
        onKeyDown={handleKeyDown}
        className={`${BASE_BAR_CLASSNAME} pr-9 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${inputClassName}`}
      />
      {selected && !disabled ? (
        <button
          type="button"
          aria-label="Clear selection"
          onClick={() => {
            commit(null);
            inputRef.current?.focus();
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded px-1 text-sm text-slate-400 hover:text-slate-600"
        >
          ×
        </button>
      ) : null}
      {open && !disabled ? (
        <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <ul ref={listRef} id={`${instanceId}-listbox`} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {visible.length === 0 ? (
              <li className="px-3.5 py-2 text-sm text-slate-400">{emptyLabel}</li>
            ) : (
              visible.map((option, index) => (
                <li
                  key={option.value}
                  id={`${instanceId}-option-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={String(option.value) === String(value)}
                  onMouseEnter={() => setHighlightIndex(index)}
                  onMouseDown={(event) => {
                    // mousedown, not click: the input's blur would otherwise close the panel first.
                    event.preventDefault();
                    commit(option);
                  }}
                  className={`cursor-pointer px-3.5 py-2 text-sm ${
                    index === highlightIndex ? "bg-slate-100 text-slate-900" : "text-slate-700"
                  }`}
                >
                  <div>{highlight(option.label, query.trim())}</div>
                  {option.hint ? <div className="text-xs text-slate-400">{option.hint}</div> : null}
                </li>
              ))
            )}
          </ul>
          {matches.length > visible.length ? (
            <div className="border-t border-slate-100 px-3.5 py-1.5 text-xs text-slate-400">
              Showing {visible.length} of {matches.length} — keep typing to narrow
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
