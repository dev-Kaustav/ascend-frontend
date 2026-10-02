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

  // Like storeFetch, but resolves to { status, body } so a caller that must tell a 201 from any other
  // success (placing an order) can. The same identity binding and the same no-replay rule apply.
  function storeFetchResponse(path, options = {}) {
    return requestPrivate(path, options, async (response) => ({ status: response.status, body: await readJson(response) }));
  }

  return { storeFetch, storeFetchBlob, storeFetchResponse };
}

// ---- placing an order ---------------------------------------------------------------------------------
//
// The checkout controller is the one place an order is sent from. It is plain JavaScript with every
// dependency injected (transport, storage, session generation), so node:test drives the same code the
// page runs. What it guarantees:
//   - one send per submission: the in-flight lock is a variable set before the first await, so two
//     clicks in the same tick cannot both pass, whatever React has or has not rendered yet;
//   - the body is the cart's SKU ids and whole packets plus the chosen address id, nothing else: no
//     price, warehouse, retailer or salesman reaches the server (it re-prices and reserves);
//   - success is a 201 carrying an order id and nothing else; a lost, late or odd answer is never
//     read as success, and an order is never sent a second time by the app.
const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isPositiveInt = (value) => Number.isInteger(value) && value > 0;
const MAX_ORDER_LINES = 50;
const MAX_PACKETS = 999;

/**
 * The POST /store/orders body for these { sku_id, quantity } lines and this address id, or null when
 * it cannot be an order (no lines, more than 50, a repeated product, fractional or zero packets, over
 * 999, no usable address id). Only sku_id, quantity and address_id are ever copied across.
 */
export function orderRequestBody(items, addressId) {
  if (!Array.isArray(items) || items.length < 1 || items.length > MAX_ORDER_LINES) return null;
  const seen = new Set();
  const lines = [];
  for (const item of items) {
    if (!isPlainObject(item) || !isPositiveInt(item.sku_id) || seen.has(item.sku_id)) return null;
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_PACKETS) return null;
    seen.add(item.sku_id);
    lines.push({ sku_id: item.sku_id, quantity: item.quantity });
  }
  const id = typeof addressId === "string" && /^[1-9]\d{0,9}$/.test(addressId) ? Number(addressId) : addressId;
  if (!isPositiveInt(id)) return null;
  return { items: lines, address_id: id };
}

/**
 * Whether Place order may be pressed, and when not, why. canPurchase: a ready retailer session.
 * readiness: the cart's readiness (ready only for a current quote of exactly the cart, all in stock).
 * address: the selected address (already required to be one the server lists), addresses: the list.
 * view: the checkout state for this cart and identity.
 * reason: signed-out | empty | submitting | unverified | review | quote | no-address | choose-address.
 */
export function checkoutGate({ canPurchase, lineCount, readiness, address, addresses, view }) {
  const blocked = (reason) => ({ canPlace: false, reason });
  if (!canPurchase) return blocked("signed-out");
  if (!lineCount) return blocked("empty");
  const phase = view?.phase ?? "idle";
  if (phase === "submitting") return blocked("submitting");
  if (phase === "uncertain") return blocked("unverified");
  if (phase === "stock-review") return blocked("review");
  if (!readiness?.ready) return blocked("quote");
  const list = Array.isArray(addresses) ? addresses : [];
  if (list.length === 0) return blocked("no-address");
  if (!address || !list.some((candidate) => String(candidate.id) === String(address.id))) return blocked("choose-address");
  return { canPlace: true, reason: null };
}

export const IDLE_CHECKOUT = Object.freeze({ phase: "idle", owner: null, review: Object.freeze([]), problem: null, order: null, check: null, cause: null });

// A state is shown only for the identity it was asked under. A stock review or refusal is also tied to
// the cart revision it was about: an edited cart starts clean. An unconfirmed order outlives the session
// (it belongs to the retailer), so it is shown to the same retailer after a new sign-in.
export function checkoutView(state, identity, revision) {
  if (!state || !state.owner || !identity) return IDLE_CHECKOUT;
  if (String(state.owner.retailerId) !== String(identity.retailerId)) return IDLE_CHECKOUT;
  if (state.phase === "uncertain") return state;
  if (state.owner.generation !== identity.generation) return IDLE_CHECKOUT;
  if ((state.phase === "stock-review" || state.phase === "refused") && state.owner.revision !== revision) return IDLE_CHECKOUT;
  return state;
}

// What the app reads from a 201: the id it will open, and the server's own amount and address kept for
// display. The order page reads everything back from the server, so only a usable id is required.
function readConfirmedOrder(body) {
  if (!isPlainObject(body) || !isPositiveInt(body.id)) return null;
  return {
    id: body.id,
    status: typeof body.status === "string" ? body.status : null,
    total: typeof body.total === "number" && Number.isFinite(body.total) ? body.total : null,
    ship_to: isPlainObject(body.ship_to) ? body.ship_to : null
  };
}

const validOwner = (owner) =>
  isPlainObject(owner) && Number.isInteger(owner.generation) && owner.retailerId != null && Number.isInteger(owner.revision);

const sameRetailer = (a, b) => a != null && b != null && String(a) === String(b);

// ---- an order nobody saw the answer to is written down ------------------------------------------------
// The app cannot know whether an order whose answer was lost reached the server (there is no
// idempotency key). So the attempt is recorded under the retailer's key BEFORE the send and removed only
// when the answer is definite (confirmed, refused, or never sent). A reload, a closed tab or a lost
// response therefore all leave the same mark, and while it stands Place order is off until the orders
// have been read back and the person has said to go on. The mark holds a time and nothing else.
export const PENDING_ORDER_PREFIX = "ascend_store_pending_order:";

function pendingKey(retailerId) {
  const id = String(retailerId);
  return /^[1-9]\d{0,9}$/.test(id) ? `${PENDING_ORDER_PREFIX}${id}` : null;
}

/** { at } when an order for this retailer was sent and never settled, else null. Never throws. */
export function readPendingOrder(storage, retailerId) {
  const key = pendingKey(retailerId);
  if (!key || !storage) return null;
  try {
    const parsed = JSON.parse(storage.getItem(key));
    return isPlainObject(parsed) && typeof parsed.at === "string" && parsed.at !== "" ? { at: parsed.at } : null;
  } catch {
    return null;
  }
}

function writePendingOrder(storage, retailerId, at) {
  const key = pendingKey(retailerId);
  if (!key || !storage) return false;
  try {
    storage.setItem(key, JSON.stringify({ at }));
    return true;
  } catch {
    // Without storage the mark lives only as long as this page; the in-memory state still blocks a resend.
    return false;
  }
}

function clearPendingOrder(storage, retailerId) {
  const key = pendingKey(retailerId);
  if (!key || !storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Nothing more can be done; the mark is only a guard.
  }
}

// ---- what a failed order means ------------------------------------------------------------------------
// Fixed copy: nothing the server said is ever shown.
export const PLACEMENT_COPY = Object.freeze({
  uncertain: "We couldn't confirm your order. Check My orders before trying again.",
  stock: "Availability changed. Review these items before placing your order.",
  address: "That delivery address isn't available any more. Check where we deliver, then place your order again.",
  changed: "Your cart changed. Review it and place your order again.",
  notSent: "We couldn't check your delivery address, so your order was not sent. Your cart is saved. Try again.",
  notSentOffline: "We couldn't reach the store, so your order was not sent. Your cart is saved. Try again.",
  signedOut: "Your session ended, so your order was not sent. Log in again. Your cart is saved.",
  unavailable: "Some products in your cart are no longer available. Remove them to continue.",
  closed: "We aren't taking orders right now. Your cart is saved.",
  denied: "This account can't place orders right now.",
  busy: "Too many attempts. Wait a moment, then place your order again.",
  invalid: "We couldn't place this order. Review your cart and try again."
});

// The two exact answers the app itself gives. Anything else with the same status (a proxy's 503, a
// different 404) is not known to be a refusal, and so is treated as an answer nobody saw.
const STORE_CLOSED_DETAIL = "Store is not taking orders right now";
const ADDRESS_MISSING_DETAIL = "Address not found";

/**
 * Sorts a failed POST /store/orders into what it means for the person:
 *   { outcome: "stale" }                       the account changed; say nothing to the new one
 *   { outcome: "stock", items }                409 STOCK_CHANGED: review the cap on each named line
 *   { outcome: "refused", kind, message, skuIds, sent }   the order definitely was not placed
 *   { outcome: "uncertain", message }          it may or may not exist: never replayed, never claimed
 * A refused request that never left the browser (the session could not be refreshed) has sent: false.
 * A 401 on the order itself is uncertain, as is any 5xx, a timeout and a network failure.
 */
export function classifyPlacementError(error) {
  const uncertain = { outcome: "uncertain", message: PLACEMENT_COPY.uncertain };
  if (!(error instanceof StoreApiError)) return uncertain;
  const refused = (kind, message, extra = {}) => ({ outcome: "refused", kind, message, skuIds: [], sent: true, ...extra });
  const { reason, status, payload } = error;

  if (reason === "stale") return { outcome: "stale" };
  if (reason === "needs-login" || reason === "session-expired") return refused("signed-out", PLACEMENT_COPY.signedOut, { sent: false });
  if (reason === "refresh-unavailable") return refused("not-sent", PLACEMENT_COPY.notSentOffline, { sent: false });
  if (reason === "network") return uncertain;

  const detail = isPlainObject(payload) ? payload.detail : null;
  if (status === 409) {
    if (!isPlainObject(payload) || payload.code !== "STOCK_CHANGED") return refused("invalid", PLACEMENT_COPY.invalid);
    const items = [];
    for (const item of Array.isArray(payload.items) ? payload.items : []) {
      if (!isPlainObject(item) || !isPositiveInt(item.sku_id) || !Number.isInteger(item.max_quantity) || item.max_quantity < 0) continue;
      if (items.some((seen) => seen.sku_id === item.sku_id)) continue;
      items.push({ sku_id: item.sku_id, max_quantity: item.max_quantity });
    }
    return { outcome: "stock", items, message: PLACEMENT_COPY.stock };
  }
  if (status === 422) {
    const skuIds = isPlainObject(detail) && Array.isArray(detail.sku_ids) ? detail.sku_ids.filter(isPositiveInt) : [];
    return skuIds.length > 0 ? refused("unavailable", PLACEMENT_COPY.unavailable, { skuIds }) : refused("invalid", PLACEMENT_COPY.invalid);
  }
  if (status === 404) return detail === ADDRESS_MISSING_DETAIL ? refused("address", PLACEMENT_COPY.address) : refused("invalid", PLACEMENT_COPY.invalid);
  if (status === 403) return refused("denied", PLACEMENT_COPY.denied);
  if (status === 429) return refused("busy", PLACEMENT_COPY.busy);
  if (status === 503 && detail === STORE_CLOSED_DETAIL) return refused("closed", PLACEMENT_COPY.closed);
  // Any other plain client error was answered by a server that did not take the order. A timeout (408)
  // and a 401 are not treated that way: the person could not tell whether the order was kept.
  if (status >= 400 && status < 500 && status !== 401 && status !== 408) return refused("invalid", PLACEMENT_COPY.invalid);
  return uncertain;
}

const CHECK_ORDERS = 3; // the newest few are enough to see whether the order is there

function defaultParseOrderList(body) {
  if (!isPlainObject(body) || !Array.isArray(body.items) || !Number.isInteger(body.total)) return null;
  return { items: body.items.filter((item) => isPlainObject(item) && isPositiveInt(item.id)), total: body.total };
}

/**
 * deps.post(path, init) -> { status, body } (the transport's storeFetchResponse); deps.get(path) -> body.
 * deps.getStorage() -> storage | null. deps.getGeneration() -> the current session generation.
 * deps.parseOrderList(body) -> { items, total } | null. deps.now() -> an ISO time.
 * deps.onConfirmed({ order, owner, items }) runs once per confirmed order, whoever is signed in now.
 *
 * phase: idle | submitting | stock-review | refused | uncertain | confirmed.
 */
export function createCheckoutController(deps = {}) {
  const post = deps.post || ((path, init) => defaultTransport.storeFetchResponse(path, init));
  const get = deps.get || ((path, init) => defaultTransport.storeFetch(path, init));
  const getGeneration = deps.getGeneration || (() => null);
  const parseOrderList = deps.parseOrderList || defaultParseOrderList;
  const now = deps.now || (() => new Date().toISOString());
  let onConfirmed = deps.onConfirmed || (() => {});
  const storage = () => {
    try {
      return deps.getStorage ? deps.getStorage() : null;
    } catch {
      return null;
    }
  };

  let state = IDLE_CHECKOUT;
  let inFlight = false;
  let readToken = 0;
  const listeners = new Set();

  function set(next) {
    state = Object.freeze({ ...IDLE_CHECKOUT, ...next });
    listeners.forEach((listener) => listener());
  }

  const stillSignedIn = (owner) => getGeneration() === owner.generation;
  const ownedBy = (identity) => state.owner && identity && state.owner.generation === identity.generation && sameRetailer(state.owner.retailerId, identity.retailerId);

  /** The signed-in identity changed (or ended): drop what belonged to the previous one. An unconfirmed
   *  order is the retailer's, so it comes back to the same retailer after a new sign-in. */
  function sync(identity) {
    if (!identity) {
      if (state !== IDLE_CHECKOUT) set(IDLE_CHECKOUT);
      return;
    }
    if (ownedBy(identity)) return;
    const mark = readPendingOrder(storage(), identity.retailerId);
    if (mark) {
      set({ phase: "uncertain", owner: { generation: identity.generation, retailerId: identity.retailerId, revision: null }, cause: "unconfirmed", at: mark.at });
    } else if (state !== IDLE_CHECKOUT) {
      set(IDLE_CHECKOUT);
    }
  }

  const isUnverified = (retailerId) => (state.phase === "uncertain" && sameRetailer(state.owner?.retailerId, retailerId)) || readPendingOrder(storage(), retailerId) !== null;

  async function submit(request) {
    const { owner, items, addressId, confirmAddress, isCurrent } = request || {};
    if (inFlight) return { sent: false, reason: "in-flight" };
    if (!validOwner(owner)) return { sent: false, reason: "incomplete" };
    if (!stillSignedIn(owner)) return { sent: false, reason: "stale" };
    if (isUnverified(owner.retailerId)) {
      if (state.phase !== "uncertain") set({ phase: "uncertain", owner, cause: "unconfirmed" });
      return { sent: false, reason: "unverified" };
    }
    if (state.phase === "stock-review" && sameRetailer(state.owner?.retailerId, owner.retailerId) && state.owner.revision === owner.revision) {
      return { sent: false, reason: "review-needed" };
    }
    const body = orderRequestBody(items, addressId);
    if (!body) return { sent: false, reason: "incomplete" };

    // Locked before anything is awaited: this is what makes a double click one order.
    inFlight = true;
    set({ phase: "submitting", owner });

    // Ends the submission. The state is shown only while the same account is signed in.
    const settle = (next, result) => {
      inFlight = false;
      if (stillSignedIn(owner)) set(next);
      else if (state.owner === owner) set(IDLE_CHECKOUT);
      return result;
    };
    const refuse = (kind, message, sent = false) => settle({ phase: "refused", owner, problem: { kind, message, skuIds: [] } }, { sent, outcome: "refused", reason: kind });

    if (confirmAddress) {
      let listed;
      try {
        listed = await confirmAddress();
      } catch (error) {
        if (isStaleStoreError(error)) return settle(IDLE_CHECKOUT, { sent: false, reason: "stale" });
        return refuse("not-sent", PLACEMENT_COPY.notSent);
      }
      if (!stillSignedIn(owner) || listed === null) return settle(IDLE_CHECKOUT, { sent: false, reason: "stale" });
      if (listed === false) return refuse("address", PLACEMENT_COPY.address);
      if (isCurrent && !isCurrent()) return refuse("changed", PLACEMENT_COPY.changed);
    }

    // From here the order may reach the server whatever happens next.
    writePendingOrder(storage(), owner.retailerId, now());

    let response;
    try {
      response = await post(storeEndpoints.orders, { method: "POST", body: JSON.stringify(body) });
    } catch (error) {
      const outcome = classifyPlacementError(error);
      if (outcome.outcome === "stale") return settle(IDLE_CHECKOUT, { sent: true, outcome: "stale" });
      if (outcome.outcome === "uncertain") {
        return settle({ phase: "uncertain", owner, cause: "failed" }, { sent: true, outcome: "uncertain" });
      }
      // The server answered (or the request never left): the order definitely was not placed.
      clearPendingOrder(storage(), owner.retailerId);
      if (outcome.outcome === "stock") return settle({ phase: "stock-review", owner, review: outcome.items }, { sent: true, outcome: "stock" });
      return settle(
        { phase: "refused", owner, problem: { kind: outcome.kind, message: outcome.message, skuIds: outcome.skuIds } },
        { sent: outcome.sent, outcome: "refused", reason: outcome.kind }
      );
    }

    const order = response?.status === 201 ? readConfirmedOrder(response.body) : null;
    if (!order) return settle({ phase: "uncertain", owner, cause: "unreadable" }, { sent: true, outcome: "uncertain" });

    clearPendingOrder(storage(), owner.retailerId);
    const result = settle({ phase: "confirmed", owner, order }, { sent: true, outcome: "confirmed", order });
    try {
      onConfirmed({ order, owner, items: body.items });
    } catch {
      // The order is placed whatever the caller then does with it.
    }
    return result;
  }

  /** A read of the newest orders, to see with the person's own eyes whether the order is there. It does
   *  not decide anything: a recent order and a matching amount are never taken as proof. */
  async function checkOrders() {
    if (state.phase !== "uncertain" || !state.owner || state.check?.phase === "loading") return;
    const owner = state.owner;
    const token = ++readToken;
    set({ ...state, check: { phase: "loading", orders: [], total: 0 } });
    const current = () => token === readToken && state.phase === "uncertain" && state.owner === owner && stillSignedIn(owner);
    try {
      const list = parseOrderList(await get(`${storeEndpoints.orders}?limit=${CHECK_ORDERS}&offset=0`));
      if (!current()) return;
      if (!list) throw new Error("unreadable");
      set({ ...state, check: { phase: "ready", orders: list.items.slice(0, CHECK_ORDERS), total: list.total } });
    } catch (error) {
      if (isStaleStoreError(error) || !current()) return;
      set({ ...state, check: { phase: "error", orders: [], total: 0 } });
    }
  }

  /** The person has seen the orders and chooses to go on: only now is the doubt released. */
  function resolveUncertain() {
    if (state.phase !== "uncertain" || state.check?.phase !== "ready") return false;
    clearPendingOrder(storage(), state.owner.retailerId);
    set(IDLE_CHECKOUT);
    return true;
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getState: () => state,
    // The page hands in what to do with a confirmed order once it has mounted.
    setOnConfirmed(handler) {
      onConfirmed = handler || (() => {});
    },
    sync,
    submit,
    checkOrders,
    resolveUncertain,
    /** The person accepted the stock review (the cart is changed by the caller): back to idle. */
    acceptReview() {
      if (state.phase === "stock-review") set(IDLE_CHECKOUT);
    },
    /** Dismiss a refusal. */
    dismiss() {
      if (state.phase === "refused") set(IDLE_CHECKOUT);
    }
  };
}

const defaultTransport = createStoreTransport();
export const storeFetch = defaultTransport.storeFetch;
export const storeFetchBlob = defaultTransport.storeFetchBlob;
export const storeFetchResponse = defaultTransport.storeFetchResponse;
