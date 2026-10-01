"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { isStaleStoreError, storeEndpoints, storeFetch } from "@/lib/store/api.mjs";
import { disposePhoneVerifier, signOutPhoneProof } from "@/lib/store/firebase";
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

// Loaded only when the login sheet opens, so public browsing never downloads it (or Firebase).
const RetailerLoginSheet = dynamic(() => import("@/components/store/RetailerLoginSheet"), { ssr: false });

const SHEETS = ["login", "shop", "address", "cart"];
const getServerSnapshot = () => undefined;

const RetailerContext = createContext({
  status: "loading",
  readiness: "loading",
  me: null,
  retailerId: null,
  canPurchase: false,
  generation: null,
  activeSheet: null,
  pendingIntent: null,
  refreshMe: () => {},
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
  const [activeSheet, setActiveSheet] = useState(null);
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

  const openSheet = useCallback((name) => {
    // One active sheet: opening one replaces the other instead of stacking behind it.
    setActiveSheet(SHEETS.includes(name) ? name : null);
  }, []);
  const closeSheet = useCallback(() => setActiveSheet(null), []);

  // Gate for an action that needs a signed-in retailer with a confirmed shop. Returns true when
  // the caller may proceed. Otherwise it keeps the one validated intent (an internal route or a
  // SKU add) so 09-04's sheets can resume it after login/onboarding, and opens the right sheet.
  const requireRetailer = useCallback(
    (intent) => {
      if (state.canPurchase) return true;
      const valid = validateRetailerIntent(intent);
      intentRef.current = valid;
      setPendingIntent(valid);
      if (state.readiness === "anonymous") setActiveSheet("login");
      else if (state.readiness === "new" || state.readiness === "confirm") setActiveSheet("shop");
      return false;
    },
    [state.canPurchase, state.readiness]
  );

  // The retained intent is handed out once.
  const takeIntent = useCallback(() => {
    const intent = intentRef.current;
    intentRef.current = null;
    setPendingIntent(null);
    return intent;
  }, []);

  // Clears the retailer session only; the staff session is a different storage key and is not
  // read or touched. No navigation: the visitor returns to browsing where they are.
  const logout = useCallback(() => {
    intentRef.current = null;
    setPendingIntent(null);
    setActiveSheet(null);
    clearRetailerTokens();
    // The phone proof is only ever a bridge to the Ascend session; end it with the session.
    disposePhoneVerifier();
    signOutPhoneProof();
  }, []);

  // Dismissing the login sheet (close, Escape, Back) discards the destination it was holding.
  const dismissLogin = useCallback(() => {
    intentRef.current = null;
    setPendingIntent(null);
    setActiveSheet(null);
  }, []);

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
      refreshMe,
      requireRetailer,
      takeIntent,
      openSheet,
      closeSheet,
      logout
    }),
    [state, generation, activeSheet, pendingIntent, refreshMe, requireRetailer, takeIntent, openSheet, closeSheet, logout]
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
    </RetailerContext.Provider>
  );
}

export function useRetailer() {
  return useContext(RetailerContext);
}

// Retailer-only destinations. An anonymous visitor who picks one gets the login sheet in place
// instead of a navigation, and is sent on once they are ready (never to the staff /login).
const RETAILER_ONLY = ["/orders", "/account"];
const isRetailerOnly = (href) => RETAILER_ONLY.some((base) => href === base || href.startsWith(`${base}/`) || href.startsWith(`${base}?`));

/**
 * Returns href => onClick handler for a store link. A plain left click on a retailer-only
 * destination by an anonymous visitor opens login with that destination held; every other click
 * (modified, other buttons, public destinations, signed-in visitors) navigates as normal.
 */
export function useRetailerLinkGate() {
  const { readiness, requireRetailer } = useRetailer();
  return useCallback(
    (href) => (event) => {
      if (readiness !== "anonymous" || !isRetailerOnly(href)) return;
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      requireRetailer({ type: "navigate", href });
    },
    [readiness, requireRetailer]
  );
}
