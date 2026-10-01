// Transport for the public storefront and the retailer session.
//
// Deliberately independent of lib/api.js: that module attaches the staff bearer token and
// redirects to /login on 401, neither of which a storefront visitor should ever trigger.
// Nothing here imports from lib/auth.js or lib/api.js; the retailer credentials come from
// ./session.mjs and have their own storage keys.
import { isRetailerTokenExpired, retailerSession } from "./session.mjs";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export const storeEndpoints = {
  products: "/store/products",
  product: (id) => `/store/products/${encodeURIComponent(id)}`,
  categories: "/store/categories",
  brands: "/store/brands",
  me: "/store/me",
  shop: "/store/me/shop",
  addresses: "/store/me/addresses",
  address: (id) => `/store/me/addresses/${encodeURIComponent(id)}`,
  quote: "/store/cart/quote",
  orders: "/store/orders",
  order: (id) => `/store/orders/${encodeURIComponent(id)}`,
  invoicePdf: (id) => `/store/orders/${encodeURIComponent(id)}/invoice.pdf`,
  authExchange: "/auth/retailer/firebase",
  authRefresh: "/auth/refresh"
};

export class StoreApiError extends Error {
  constructor(message, { status = 0, payload = null, retryAfter = null, reason = null } = {}) {
    super(message);
    this.name = "StoreApiError";
    this.status = status;
    // The whole parsed body is kept: 409 STOCK_CHANGED carries top-level code/items, while
    // 422 nests detail {message, sku_ids}, so callers need the raw shape, not a flat string.
    this.payload = payload;
    // Seconds to wait (429), or null when the header is absent or unreadable.
    this.retryAfter = retryAfter;
    // Why the request did not complete when the server did not say so: "stale" (the account
    // changed while it was in flight), "needs-login", "session-expired", "refresh-unavailable"
    // or "network".
    this.reason = reason;
  }
}

export const isStaleStoreError = (error) => error instanceof StoreApiError && error.reason === "stale";

const staleError = () => new StoreApiError("The account changed while this request was running", { reason: "stale" });
const expiredError = () => new StoreApiError("Your session expired. Sign in again.", { status: 401, reason: "session-expired" });

function messageFor(payload, status) {
  const detail = payload && typeof payload === "object" ? payload.detail : null;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && typeof detail.message === "string") return detail.message;
  if (payload && typeof payload === "object" && typeof payload.message === "string") return payload.message;
  return `Request failed (${status})`;
}

function parseRetryAfter(value, nowMs) {
  if (!value) return null;
  if (/^\d+$/.test(value.trim())) return Number(value);
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : Math.max(0, Math.ceil((at - nowMs) / 1000));
}

// The invoice name comes from the server; strip any directory part before it is used as a
// download name.
export function parseDownloadFilename(disposition) {
  if (!disposition) return "download";
  const encoded = /filename\*\s*=\s*[^']*'[^']*'([^;]+)/i.exec(disposition);
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(disposition);
  let name = null;
  if (encoded) {
    try {
      name = decodeURIComponent(encoded[1].trim());
    } catch {
      name = encoded[1].trim();
    }
  } else if (plain) {
    name = plain[1].trim();
  }
  name = name ? name.split(/[\\/]/).pop() : "";
  return name || "download";
}

/**
 * deps.session: the retailer session (default: the browser-wide one).
 * deps.fetch: fetch implementation, resolved at call time so tests can swap it.
 * deps.baseUrl: API origin. deps.now: clock in ms.
 */
export function createStoreTransport(deps = {}) {
  const session = deps.session || retailerSession;
  const baseUrl = deps.baseUrl === undefined ? API_BASE_URL : deps.baseUrl;
  const now = deps.now || Date.now;
  const send = (url, init) => (deps.fetch || globalThis.fetch)(url, init);

  function buildUrl(path) {
    if (path.startsWith("http")) return path;
    const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    return `${base}${path.startsWith("/") ? path : `/${path}`}`;
  }

  async function perform(path, init, extraHeaders, token) {
    const headers = new Headers(extraHeaders || {});
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    try {
      // no-store: the response varies by Authorization and must never be shared.
      return await send(buildUrl(path), { ...init, headers, cache: "no-store" });
    } catch (cause) {
      throw new StoreApiError("Network error", {
        reason: "network",
        payload: { cause: String(cause?.message || cause) }
      });
    }
  }

  async function errorFromResponse(response) {
    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }
    return new StoreApiError(messageFor(payload, response.status), {
      status: response.status,
      payload,
      retryAfter: parseRetryAfter(response.headers.get("retry-after"), now())
    });
  }

  async function readJson(response) {
    if (response.status === 204) return null;
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  async function readBlob(response) {
    const blob = await response.blob();
    return { blob, filename: parseDownloadFilename(response.headers.get("content-disposition")) };
  }

  // One refresh at a time per identity generation. Concurrent 401s and expired-token checks
  // share it. Outcomes: "refreshed" | "rejected" (the server refused the refresh token, so the
  // retailer session was cleared) | "unavailable" (network/5xx/429, session kept) | "stale".
  let refreshing = null;

  function refreshSession(generation) {
    if (session.getGeneration() !== generation) return Promise.resolve("stale");
    if (refreshing && refreshing.generation === generation) return refreshing.promise;

    const refreshToken = session.getRefreshToken();
    if (!refreshToken) return Promise.resolve(session.expire(generation) ? "rejected" : "stale");

    const entry = { generation };
    entry.promise = (async () => {
      try {
        let response;
        try {
          // Raw request, never routed through storeFetch: a failing refresh must not recurse.
          response = await send(buildUrl(storeEndpoints.authRefresh), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken }),
            cache: "no-store"
          });
        } catch {
          return "unavailable";
        }
        if (response.ok) {
          const data = await response.json().catch(() => null);
          if (!data?.access_token) return "unavailable";
          // Committed only if the identity has not changed since the refresh began.
          if (session.rotate({ accessToken: data.access_token, refreshToken: data.refresh_token }, generation)) {
            return "refreshed";
          }
          if (session.getGeneration() !== generation) return "stale";
          return session.expire(generation) ? "rejected" : "stale";
        }
        if (response.status === 400 || response.status === 401 || response.status === 403) {
          return session.expire(generation) ? "rejected" : "stale";
        }
        return "unavailable";
      } finally {
        if (refreshing === entry) refreshing = null;
      }
    })();
    refreshing = entry;
    return entry.promise;
  }

  // Safe to repeat after a refresh: reads, and the quote, which only prices a cart. An order is
  // never repeated automatically; whether the first attempt landed is unknown to the caller.
  const isReplayable = (method, path) => method === "GET" || method === "HEAD" || (method === "POST" && path === storeEndpoints.quote);

  async function requestPrivate(path, options, read) {
    const { headers: extraHeaders, ...init } = options;
    delete init.public;
    const generation = session.getGeneration();
    const method = (init.method || "GET").toUpperCase();

    let token = session.getAccessToken();
    if (!token && !session.getRefreshToken()) {
      throw new StoreApiError("Sign in to continue", { status: 401, reason: "needs-login" });
    }

    // Refresh an expired credential before using it, so a request (above all an order) is never
    // sent with a token that is already known to be dead.
    if (!token || isRetailerTokenExpired(token, 30, now())) {
      const outcome = await refreshSession(generation);
      if (outcome === "rejected") throw expiredError();
      if (outcome === "stale" || session.getGeneration() !== generation) throw staleError();
      if (outcome === "unavailable") {
        throw new StoreApiError("Could not refresh your session. Check your connection and try again.", {
          reason: "refresh-unavailable"
        });
      }
      token = session.getAccessToken();
    }

    let response = await perform(path, init, extraHeaders, token);
    if (session.getGeneration() !== generation) throw staleError();

    if (response.status === 401) {
      if (isReplayable(method, path)) {
        // Another request may already have refreshed while this one was in flight.
        const current = session.getAccessToken();
        const outcome = current && current !== token ? "refreshed" : await refreshSession(generation);
        if (outcome === "rejected") throw expiredError();
        if (outcome === "stale" || session.getGeneration() !== generation) throw staleError();
        if (outcome === "refreshed") {
          response = await perform(path, init, extraHeaders, session.getAccessToken());
          if (session.getGeneration() !== generation) throw staleError();
        }
      } else {
        // Not repeated. Recover the credentials so the person's own retry has a fresh token,
        // or a clean expiry, and report this attempt's 401 as it was.
        if ((await refreshSession(generation)) === "stale") throw staleError();
      }
    }

    if (!response.ok) throw await errorFromResponse(response);
    return read(response);
  }

  /**
   * options.public: true sends no Authorization header whatever else is passed, so an
   *   anonymous catalogue read can never carry (or be cached against) a retailer identity.
   * Without it the request carries the retailer bearer, is bound to the identity it started
   *   under (a result for a previous account is rejected as stale), and signs the retailer out
   *   only when the server refuses their refresh token. 204 resolves to null.
   */
  async function storeFetch(path, options = {}) {
    if (options.public) {
      const { headers: extraHeaders, ...init } = options;
      delete init.public;
      const response = await perform(path, init, extraHeaders, null);
      if (!response.ok) throw await errorFromResponse(response);
      return readJson(response);
    }
    return requestPrivate(path, options, readJson);
  }

  // Private file download (the invoice PDF): resolves to { blob, filename }.
  function storeFetchBlob(path, options = {}) {
    return requestPrivate(path, options, readBlob);
  }

  return { storeFetch, storeFetchBlob };
}

const defaultTransport = createStoreTransport();
export const storeFetch = defaultTransport.storeFetch;
export const storeFetchBlob = defaultTransport.storeFetchBlob;
