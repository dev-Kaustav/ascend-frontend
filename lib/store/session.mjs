// Retailer (storefront) session. Independent of the staff session in lib/auth.js (D-04):
// different storage keys, different listeners, different memory. Nothing here imports from
// lib/auth.js or lib/api.js, and nothing here reads or writes a staff key.
//
// The JWT is read locally for presentation only (user_id/role/tv). Whether a visitor may buy is
// decided by the server's /store/me onboarding state, never by the role claim.
//
// Every identity change (sign-in, logout, expiry, switch in another tab) increments a
// generation. Work started under one generation checks it before committing a result, so a
// refresh or a /store/me response that lands after a logout or an account switch is dropped
// instead of resurrecting the old credentials (T-09-03-1).

export const RETAILER_ACCESS_KEY = "ascend_store_access_token";
export const RETAILER_REFRESH_KEY = "ascend_store_refresh_token";

const RETAILER_ROLE = "RETAILER";
const MAX_LINE_QUANTITY = 999; // backend MAX_LINE_QUANTITY, see schemas/store.py

export function parseRetailerIdentity(token) {
  const claims = decodeClaims(token);
  if (!claims) return null;
  const userId = claims.user_id ?? null;
  if (userId === null || String(claims.role || "").toUpperCase() !== RETAILER_ROLE) return null;
  return {
    userId,
    role: RETAILER_ROLE,
    tokenVersion: claims.tv ?? 0,
    exp: claims.exp ?? null
  };
}

function decodeClaims(token) {
  if (typeof token !== "string") return null;
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const claims = JSON.parse(atob(padded));
    return claims && typeof claims === "object" ? claims : null;
  } catch {
    return null;
  }
}

// exp is seconds since the epoch. The skew refreshes a token that would expire mid-request.
// A token with no readable exp counts as live: the server remains the authority.
export function isRetailerTokenExpired(token, skewSeconds = 30, nowMs = Date.now()) {
  const exp = decodeClaims(token)?.exp;
  if (!exp) return false;
  return exp * 1000 <= nowMs + skewSeconds * 1000;
}

function defaultStorage() {
  if (typeof window === "undefined") return null;
  try {
    const storage = window.localStorage;
    // Safari private mode exposes localStorage but throws on use.
    storage.getItem(RETAILER_ACCESS_KEY);
    return storage;
  } catch {
    return null;
  }
}

/**
 * deps.getStorage: () => Storage-like | null, called on every access so a storage that becomes
 *   unavailable is survived. deps.eventTarget: where `storage` events arrive (window), or null.
 */
export function createRetailerSession(deps = {}) {
  const getStorage = deps.getStorage || defaultStorage;
  const eventTarget = deps.eventTarget === undefined ? (typeof window === "undefined" ? null : window) : deps.eventTarget;

  const listeners = new Set();
  let access = null;
  let refresh = null;
  let generation = 0;
  let expired = false;
  let loaded = false;
  let snapshot = null;

  function rebuild() {
    snapshot = Object.freeze({ accessToken: access, refreshToken: refresh, generation, expired });
  }

  function notify() {
    for (const listener of [...listeners]) listener();
  }

  function readStorage() {
    try {
      const storage = getStorage();
      if (!storage) return { access: null, refresh: null };
      return { access: storage.getItem(RETAILER_ACCESS_KEY), refresh: storage.getItem(RETAILER_REFRESH_KEY) };
    } catch {
      return { access: null, refresh: null };
    }
  }

  // Storage is read once; afterwards memory is the source of truth for this tab, so a storage
  // that blocks writes or reads still leaves a working same-tab session.
  function ensureLoaded() {
    if (loaded) return;
    loaded = true;
    ({ access, refresh } = readStorage());
    rebuild();
  }

  function writeStorage(nextAccess, nextRefresh) {
    let storage = null;
    try {
      storage = getStorage();
    } catch {
      storage = null;
    }
    if (!storage) return;
    for (const [key, value] of [
      [RETAILER_ACCESS_KEY, nextAccess],
      [RETAILER_REFRESH_KEY, nextRefresh]
    ]) {
      try {
        if (value) storage.setItem(key, value);
        else storage.removeItem(key);
      } catch {
        // Blocked or full: the in-memory copy still carries this tab's session.
      }
    }
  }

  function commit(nextAccess, nextRefresh, { bump, nextExpired = false }) {
    ensureLoaded();
    access = nextAccess || null;
    refresh = nextRefresh || null;
    if (bump) generation += 1;
    expired = nextExpired;
    writeStorage(access, refresh);
    rebuild();
    notify();
  }

  function sameAccount(prevAccess, nextAccess) {
    const prev = parseRetailerIdentity(prevAccess);
    const next = parseRetailerIdentity(nextAccess);
    return Boolean(prev && next && prev.userId === next.userId);
  }

  // localStorage is shared across tabs and the `storage` event fires only in the others. Reload
  // from it; a different account or a removal is an identity change, a rotation is not.
  function onStorageEvent(event) {
    if (event && event.key !== null && event.key !== RETAILER_ACCESS_KEY && event.key !== RETAILER_REFRESH_KEY) return;
    ensureLoaded();
    const previous = access;
    ({ access, refresh } = readStorage());
    if (!sameAccount(previous, access)) {
      generation += 1;
      expired = false;
    }
    rebuild();
    notify();
  }

  if (eventTarget && typeof eventTarget.addEventListener === "function") {
    eventTarget.addEventListener("storage", onStorageEvent);
  }

  return {
    getSnapshot() {
      ensureLoaded();
      return snapshot;
    },
    getAccessToken() {
      ensureLoaded();
      return access;
    },
    getRefreshToken() {
      ensureLoaded();
      return refresh;
    },
    getGeneration() {
      ensureLoaded();
      return generation;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    // A new sign-in. Always a new generation: whatever was in flight belonged to someone else.
    save({ accessToken, refreshToken }) {
      commit(accessToken, refreshToken, { bump: true });
    },
    // A refresh result. Committed only if no identity change happened since the refresh began,
    // and only for the same account.
    rotate({ accessToken, refreshToken }, expectedGeneration) {
      ensureLoaded();
      if (expectedGeneration !== generation) return false;
      if (access && !sameAccount(access, accessToken)) return false;
      commit(accessToken, refreshToken || refresh, { bump: false });
      return true;
    },
    clear() {
      commit(null, null, { bump: true });
    },
    // The server rejected the refresh token: sign the retailer out, once, and remember why so
    // the UI can ask them to sign in again. A stale generation must not log out the new account.
    expire(expectedGeneration) {
      ensureLoaded();
      if (expectedGeneration !== generation) return false;
      commit(null, null, { bump: true, nextExpired: true });
      return true;
    }
  };
}

/**
 * Pure view of the credentials plus the last /store/me outcome.
 * meRecord: { generation, me?, error? } stamped with the generation it was requested under, so
 * a result that belongs to a previous account is never exposed.
 */
export function deriveRetailerState(snapshot, meRecord) {
  const blank = { me: null, retailerId: null, canPurchase: false, generation: snapshot?.generation ?? null };
  if (!snapshot) return { ...blank, status: "loading", readiness: "loading" };

  const hasCredentials = Boolean(snapshot.accessToken || snapshot.refreshToken);
  if (!hasCredentials) {
    return { ...blank, status: snapshot.expired ? "expired" : "anonymous", readiness: "anonymous" };
  }
  // A token under the store keys that is not a retailer's is not a store session (T-09-03-3).
  if (snapshot.accessToken && !parseRetailerIdentity(snapshot.accessToken)) {
    return { ...blank, status: "anonymous", readiness: "anonymous", invalidCredentials: true };
  }

  const current = meRecord && meRecord.generation === snapshot.generation ? meRecord : null;
  if (!current) return { ...blank, status: "authed", readiness: "loading" };
  if (current.error || !current.me) return { ...blank, status: "authed", readiness: "error" };

  const { me } = current;
  if (!["new", "confirm", "ready"].includes(me.onboarding)) return { ...blank, status: "authed", readiness: "error" };

  const retailerId = me.shop?.retailer_id ?? null;
  return {
    ...blank,
    status: "authed",
    readiness: me.onboarding,
    me,
    retailerId,
    canPurchase: me.onboarding === "ready" && retailerId !== null
  };
}

/**
 * One intent is held across login: either an internal route or a whole-packet SKU add. Returns
 * the normalised intent, or null for anything else, so an external or malformed destination
 * can never become a post-login redirect.
 */
export function validateRetailerIntent(intent) {
  if (!intent || typeof intent !== "object") return null;

  if (intent.type === "navigate") {
    const href = intent.href;
    if (typeof href !== "string" || href.length === 0 || href.length > 2048) return null;
    if (!href.startsWith("/") || href.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(href)) return null;
    try {
      const parsed = new URL(href, "https://store.invalid");
      if (parsed.origin !== "https://store.invalid") return null;
      return { type: "navigate", href: parsed.pathname + parsed.search + parsed.hash };
    } catch {
      return null;
    }
  }

  if (intent.type === "add") {
    const quantity = intent.quantity === undefined ? 1 : intent.quantity;
    if (!Number.isInteger(intent.skuId) || intent.skuId < 1) return null;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) return null;
    return { type: "add", skuId: intent.skuId, quantity };
  }

  return null;
}

// The browser-wide session. Safe to import on the server: nothing touches window until used.
export const retailerSession = createRetailerSession();

export const getRetailerSession = () => retailerSession.getSnapshot();
export const getRetailerAccessToken = () => retailerSession.getAccessToken();
export const getRetailerRefreshToken = () => retailerSession.getRefreshToken();
export const getSessionGeneration = () => retailerSession.getGeneration();
export const subscribeRetailerSession = (listener) => retailerSession.subscribe(listener);
export const saveRetailerTokens = (tokens) => retailerSession.save(tokens);
export const rotateRetailerTokens = (tokens, expectedGeneration) => retailerSession.rotate(tokens, expectedGeneration);
export const clearRetailerTokens = () => retailerSession.clear();
export const expireRetailerSession = (expectedGeneration) => retailerSession.expire(expectedGeneration);
