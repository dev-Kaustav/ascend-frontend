"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";

// Type-to-filter replacement for a native <select> whose option list is too long to scroll.
// Filtering is client-side over options already in memory; swap the memo for a debounced
// fetch if a list ever outgrows what the form downloads up front.

// 16px on phones so iOS Safari does not zoom the page in on focus; 14px from md up.
// See the note on the same constant in components/ui/InputBars.jsx.
const BASE_BAR_CLASSNAME =
  "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-base md:text-sm text-slate-700 transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-[#7c3aed] focus:outline-none focus:ring-1 focus:ring-[#7c3aed]/30";

// Phones and tablets: a coarse pointer. Subscribed with a server snapshot of false, so the server
// render and the first client render agree and React does not warn about a mismatch.
const COARSE = "(pointer: coarse)";
const subscribeTouch = (callback) => {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const query = window.matchMedia(COARSE);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
};
const readTouch = () => typeof window !== "undefined" && Boolean(window.matchMedia?.(COARSE).matches);

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
  ariaLabel,
  emptyLabel = "No matches",
  disabled = false,
  className = "",
  inputClassName = "",
  maxResults = 100,
  // Optional leading icon (a lucide element), e.g. <Plus /> for an "add a product" picker.
  icon = null
}) {
  const [open, setOpen] = useState(false);
  // Touch screens browse first: the box itself is read-only, so a tap opens the list without a
  // keyboard. Typing happens in a real search field at the top of the list; tapping a real input
  // is the one thing every phone reliably answers with its keyboard.
  const touch = useSyncExternalStore(subscribeTouch, readTouch, () => false);
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

  // Closed: show the selection. Open on desktop: show what is being typed (touch types in the panel).
  const displayValue = open && !touch ? query : selected?.label || "";

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

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const commit = (option) => {
    onChange(option ? String(option.value) : "");
    close();
    // On a phone, picking an item is the end of the job: drop focus so no keyboard lingers.
    if (touch && typeof document !== "undefined") document.activeElement?.blur?.();
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
      close();
      return;
    }
    if (event.key === "Tab" && open) {
      close();
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {icon ? (
        <span className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 text-slate-500 [&>svg]:h-4 [&>svg]:w-4">
          {icon}
        </span>
      ) : null}
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label={ariaLabel || placeholder}
        aria-expanded={open}
        aria-controls={`${instanceId}-listbox`}
        aria-autocomplete="list"
        aria-activedescendant={open && visible[highlightIndex] ? `${instanceId}-option-${highlightIndex}` : undefined}
        autoComplete="off"
        disabled={disabled}
        // Read-only on touch: a tap opens the list, never the keyboard.
        readOnly={touch}
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
          if (!touch) event.target.select();
        }}
        onClick={() => {
          // Already focused (so no focus event) but closed, e.g. after picking: reopen.
          if (!open) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        className={`${BASE_BAR_CLASSNAME} pr-9 ${icon ? "pl-10" : ""} ${touch ? "cursor-pointer caret-transparent" : ""} disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${inputClassName}`}
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
          {touch ? (
            <div className="relative border-b border-slate-100 p-2">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setHighlightIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Type to search"
                aria-label={`Search ${ariaLabel || placeholder}`}
                aria-controls={`${instanceId}-listbox`}
                autoComplete="off"
                className="h-11 w-full rounded-lg bg-slate-50 pl-9 pr-3 text-base text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/25"
              />
            </div>
          ) : null}
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
                  className={`cursor-pointer px-3.5 py-2 text-sm [@media(pointer:coarse)]:py-3 ${
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
