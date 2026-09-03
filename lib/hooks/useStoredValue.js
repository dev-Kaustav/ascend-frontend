"use client";

import { useCallback, useSyncExternalStore } from "react";

// Reads a localStorage value into React without a cascading render.
//
// The usual shape for this is useEffect + setState, which renders once with the default,
// then immediately again with the stored value. That is what react-hooks/set-state-in-effect
// flags, and on a server-rendered page it is also a hydration hazard: the server has no
// localStorage, so it renders one thing and the browser renders another.
//
// useSyncExternalStore is built for exactly this — state React does not own, that the
// server cannot see. getServerSnapshot supplies the value used on the server AND during
// hydration, so the two agree; React then reads the live value as an ordinary update.
//
// Storage is the single source of truth here: writes go through writeStored, which
// notifies subscribers, so every reader re-renders with the new value. Callers do not
// need a parallel useState.

const listeners = new Set();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange) {
  listeners.add(onStoreChange);
  // `storage` fires only in *other* tabs, so same-tab writes need the emitter above.
  const onStorage = () => onStoreChange();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function readStored(key) {
  if (!key || typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key, value) {
  if (!key || typeof window === "undefined") return;
  try {
    if (value === null || value === undefined) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Quota exceeded or storage blocked (Safari private mode). The UI still works, the
    // preference just does not survive a reload.
  }
  emit();
}

const getServerSnapshot = () => undefined;

// Returns the raw string, null when unset, or undefined while hydrating — so "not read
// yet" stays distinguishable from "explicitly absent".
export default function useStoredValue(key) {
  const getSnapshot = useCallback(() => readStored(key), [key]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
