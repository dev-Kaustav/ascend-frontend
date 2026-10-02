"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { isStaleStoreError, storeEndpoints, storeFetch } from "@/lib/store/api.mjs";
import { disposePhoneVerifier, signOutPhoneProof } from "@/lib/store/firebase";
import {
  clearSelectedAddressId,
  readSelectedAddressId,
  resolveSelectedAddress,
  saveSelectedAddressId
} from "@/lib/store/maps.mjs";
import {
  clearRetailerTokens,
  deriveRetailerState,
  getRetailerSession,
  getSessionGeneration,
  subscribeRetailerSession,
  validateRetailerIntent
} from "@/lib/store/session.mjs";

// Retailer state for the storefront only. It reads the retailer session (its own storage keys)
// and never touches the staff provider or staff storage (D-04); /login, /landing and /app are
// outside the store layout that mounts it.
//
// Same hydration rule as the staff AuthProvider: the server cannot see browser storage, so
// getServerSnapshot returns undefined, which renders as "loading" on the server and during
// hydration and is only then replaced by the real credentials.
//
// The provider never blocks rendering: whatever the state (loading, anonymous, expired, error)
// the shell and the public catalogue stay usable.

// Loaded only when a sheet opens, so public browsing never downloads them (or Firebase, or Maps).
const RetailerLoginSheet = dynamic(() => import("@/components/store/RetailerLoginSheet"), { ssr: false });
const ShopSheet = dynamic(() => import("@/components/store/ShopSheet"), { ssr: false });

const SHEETS = ["login", "shop", "address", "cart"];
const getServerSnapshot = () => undefined;
const NO_ADDRESSES = [];

// The remembered address id lives in localStorage, an external store: other tabs change it (the
// storage event) and this tab's own writes notify the same subscribers.
const selectionListeners = new Set();
const notifySelection = () => selectionListeners.forEach((listener) => listener());
function subscribeSelection(listener) {
  selectionListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    selectionListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function browserStorage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

const RetailerContext = createContext({
  status: "loading",
  readiness: "loading",
  me: null,
  retailerId: null,
  canPurchase: false,
  generation: null,
  activeSheet: null,
  pendingIntent: null,
  addresses: [],
  selectedAddress: null,
  refreshMe: () => {},
  reloadMe: async () => null,
  applyMe: () => false,
  selectAddress: () => false,
  forgetAddress: () => {},
  openAddresses: () => {},
  requireRetailer: () => false,
  takeIntent: () => null,
  openSheet: () => {},
  closeSheet: () => {},
  logout: () => {}
});

export function RetailerProvider({ children }) {
  const snapshot = useSyncExternalStore(subscribeRetailerSession, getRetailerSession, getServerSnapshot);
  // Stamped with the generation it was requested under, so the result for a previous account
  // is never shown after a logout or an account switch (see deriveRetailerState).
  const [meRecord, setMeRecord] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  // The sheet someone asked for, and the identity it was asked under. Shop and address sheets show
  // an account's data, so they only count for that identity (see activeSheet below).
  const [sheetState, setSheetState] = useState(null);
  const [promptDone, setPromptDone] = useState(null); // generation whose shop prompt was answered
  const [pendingIntent, setPendingIntent] = useState(null);
  const intentRef = useRef(null);

  const state = useMemo(() => deriveRetailerState(snapshot, meRecord), [snapshot, meRecord]);
  const generation = snapshot?.generation ?? null;

  // A token under the store keys that is not a retailer's is not a store session.
  useEffect(() => {
    if (state.invalidCredentials) clearRetailerTokens();
  }, [state.invalidCredentials]);

  // Server-owned onboarding: /store/me decides new/confirm/ready. Re-runs only when the identity
  // changes (or on refreshMe); a token rotation keeps the generation and does not refetch.
  const authed = state.status === "authed";
  useEffect(() => {
    if (!authed || generation === null) return undefined;
    let cancelled = false;
    storeFetch(storeEndpoints.me)
      .then((me) => {
        if (cancelled || getSessionGeneration() !== generation) return;
        setMeRecord({ generation, me });
      })
      .catch((error) => {
        if (cancelled || isStaleStoreError(error)) return;
        // 403: the credentials are not a retailer's. Anything else leaves the credentials alone
        // (an expiry has already been recorded by the transport) and shows a retryable error.
        if (error?.status === 403) {
          clearRetailerTokens();
          return;
        }
        if (getSessionGeneration() !== generation) return;
        setMeRecord({ generation, error });
      });
    return () => {
      cancelled = true;
    };
  }, [authed, generation, reloadKey]);

  const refreshMe = useCallback(() => {
    setMeRecord(null);
    setReloadKey((key) => key + 1);
  }, []);

  // A fresh /store/me without going back to "loading" (an address was added, edited or deleted),
  // so the open sheet stays on screen. Bound to the identity it started under: the answer for a
  // previous account is dropped. Rejects with the transport's error for the caller to word.
  const reloadMe = useCallback(async () => {
    const started = getSessionGeneration();
    try {
      const me = await storeFetch(storeEndpoints.me);
      if (getSessionGeneration() !== started) return null;
      setMeRecord({ generation: started, me });
      return me;
    } catch (error) {
      if (isStaleStoreError(error)) return null;
      throw error;
    }
  }, []);

  // The shop sheet's PUT already returns the new /store/me; take it as it is.
  const applyMe = useCallback((me, started) => {
    if (getSessionGeneration() !== started) return false;
    setMeRecord({ generation: started, me });
    return true;
  }, []);

  const openSheet = useCallback((name) => {
    // One active sheet: opening one replaces the other instead of stacking behind it.
    setSheetState(SHEETS.includes(name) ? { name, generation: getSessionGeneration() } : null);
  }, []);
  // Closing also answers the shop prompt for this identity, so a dismissed shop sheet is not
  // pushed back at the person until they reload or try something that needs a shop.
  const closeSheet = useCallback(() => {
    setSheetState(null);
    setPromptDone(getSessionGeneration());
  }, []);

  const readiness = state.readiness;
  const needsShop = readiness === "new" || readiness === "confirm";

  // What is on screen. Login follows the visitor through the identity change it causes; the shop
  // and address sheets only count for the identity that opened them and only while that identity is
  // in the state they are for. A new or confirm retailer is shown the shop sheet once per identity
  // without asking (onboarding is the server's answer, so a reload resumes it).
  let activeSheet = null;
  if (sheetState && (sheetState.name === "login" || sheetState.generation === generation)) activeSheet = sheetState.name;
  if (activeSheet === "address" && readiness !== "ready") activeSheet = null;
  if (activeSheet === "shop" && readiness === "anonymous") activeSheet = null;
  if (activeSheet === null && needsShop && promptDone !== generation) activeSheet = "shop";

  // ---- Selected delivery address -------------------------------------------------------------
  // The server owns the addresses (state.me.addresses). The browser remembers one id, per
  // retailer, and it only counts while the server still lists it: membership in the list is the
  // check, so a deleted or foreign id is simply not a selection.
  const addresses = useMemo(() => state.me?.addresses ?? NO_ADDRESSES, [state.me]);
  const retailerId = state.retailerId;
  const storedId = useSyncExternalStore(
    subscribeSelection,
    useCallback(() => readSelectedAddressId(browserStorage(), retailerId), [retailerId]),
    () => null
  );
  const selectedAddress = useMemo(() => resolveSelectedAddress({ addresses, storedId }), [addresses, storedId]);

  // list defaults to what is rendered; a caller that has just reloaded passes the fresh list, since
  // its own render has not happened yet. An id the server does not list is never selected.
  const selectAddress = useCallback(
    (id, list = addresses) => {
      if (!list.some((address) => String(address.id) === String(id))) return false;
      saveSelectedAddressId(browserStorage(), retailerId, id);
      notifySelection();
      return true;
    },
    [addresses, retailerId]
  );

  // Called once a delete has succeeded: the remembered id goes with the address.
  const forgetAddress = useCallback(
    (id) => {
      if (String(readSelectedAddressId(browserStorage(), retailerId)) !== String(id)) return;
      clearSelectedAddressId(browserStorage(), retailerId);
      notifySelection();
    },
    [retailerId]
  );

  // Gate for an action that needs a signed-in retailer with a confirmed shop. Returns true when
  // the caller may proceed. Otherwise it keeps the one validated intent (an internal route or a
  // SKU add) so 09-04's sheets can resume it after login/onboarding, and opens the right sheet.
  const requireRetailer = useCallback(
    (intent) => {
      if (state.canPurchase) return true;
      const valid = validateRetailerIntent(intent);
      intentRef.current = valid;
      setPendingIntent(valid);
      if (state.readiness === "anonymous") openSheet("login");
      else if (state.readiness === "new" || state.readiness === "confirm") openSheet("shop");
      return false;
    },
    [state.canPurchase, state.readiness, openSheet]
  );

  // The retained intent is handed out once.
  const takeIntent = useCallback(() => {
    const intent = intentRef.current;
    intentRef.current = null;
    setPendingIntent(null);
    return intent;
  }, []);

  // Header location and Account: a ready retailer picks an address; anyone else is taken to the
  // sheet that gets them there (login, or finishing the shop). Nothing is held to resume.
  const openAddresses = useCallback(() => {
    if (state.readiness === "ready") openSheet("address");
    else if (state.readiness === "error") refreshMe();
    else if (state.readiness === "anonymous" || state.readiness === "new" || state.readiness === "confirm") {
      requireRetailer(null);
    }
  }, [state.readiness, requireRetailer, refreshMe, openSheet]);

  // Clears the retailer session only; the staff session is a different storage key and is not
  // read or touched. No navigation: the visitor returns to browsing where they are.
  const logout = useCallback(() => {
    intentRef.current = null;
    setPendingIntent(null);
    setSheetState(null);
    clearRetailerTokens();
    // The phone proof is only ever a bridge to the Ascend session; end it with the session.
    disposePhoneVerifier();
    signOutPhoneProof();
  }, []);

  // Dismissing the login or shop sheet (close, Escape, Back) discards the destination it was holding.
  const dismissLogin = useCallback(() => {
    intentRef.current = null;
    setPendingIntent(null);
    closeSheet();
  }, [closeSheet]);

  const value = useMemo(
    () => ({
      status: state.status,
      readiness: state.readiness,
      me: state.me,
      retailerId: state.retailerId,
      canPurchase: state.canPurchase,
      generation,
      activeSheet,
      pendingIntent,
      addresses,
      selectedAddress,
      refreshMe,
      reloadMe,
      applyMe,
      selectAddress,
      forgetAddress,
      openAddresses,
      requireRetailer,
      takeIntent,
      openSheet,
      closeSheet,
      logout
    }),
    [
      state,
      generation,
      activeSheet,
      pendingIntent,
      addresses,
      selectedAddress,
      refreshMe,
      reloadMe,
      applyMe,
      selectAddress,
      forgetAddress,
      openAddresses,
      requireRetailer,
      takeIntent,
      openSheet,
      closeSheet,
      logout
    ]
  );

  return (
    <RetailerContext.Provider value={value}>
      {/* display: contents keeps the wrapper out of layout; the attributes are a stable hook for
          tests and later slices to observe the session without reading storage. */}
      <div
        style={{ display: "contents" }}
        data-retailer-status={state.status}
        data-retailer-readiness={state.readiness}
        data-retailer-generation={generation ?? ""}
        data-retailer-intent={pendingIntent?.type ?? ""}
      >
        {children}
      </div>
      {activeSheet === "login" ? <RetailerLoginSheet intent={pendingIntent} onClose={dismissLogin} /> : null}
      {/* Keyed by identity: a switched account starts a fresh form, never the previous one's draft. */}
      {activeSheet === "shop" ? <ShopSheet key={generation} intent={pendingIntent} onClose={dismissLogin} /> : null}
    </RetailerContext.Provider>
  );
}

export function useRetailer() {
  return useContext(RetailerContext);
}

// Retailer-only destinations. An anonymous visitor who picks one gets the login sheet in place
// instead of a navigation, and a retailer whose shop is not confirmed gets the shop sheet; either
// is sent on once they are ready (never to the staff /login).
const RETAILER_ONLY = ["/orders", "/account"];
const isRetailerOnly = (href) => RETAILER_ONLY.some((base) => href === base || href.startsWith(`${base}/`) || href.startsWith(`${base}?`));

/**
 * Returns href => onClick handler for a store link. A plain left click on a retailer-only
 * destination by an anonymous visitor opens login, and by a new or confirm retailer opens the shop
 * sheet, with that destination held; every other click
 * (modified, other buttons, public destinations, signed-in visitors) navigates as normal.
 */
export function useRetailerLinkGate() {
  const { readiness, requireRetailer } = useRetailer();
  return useCallback(
    (href) => (event) => {
      if (!["anonymous", "new", "confirm"].includes(readiness) || !isRetailerOnly(href)) return;
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      requireRetailer({ type: "navigate", href });
    },
    [readiness, requireRetailer]
  );
}
