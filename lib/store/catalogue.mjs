// Pure catalogue decisions for the storefront. No React, no network, no browser globals, so
// node:test runs the real code (tests/store-catalogue.test.mjs).
//
// The backend is the authority for prices, availability and caps. Nothing here invents data: it
// decides what to ask for, which viewer may see which price, which request result may win, and
// how a list is ordered. Product shape (see ascend-backend/app/schemas/store.py, StoreProduct):
//   id, code, name, brand{id,name}, category{id,name,icon_url}, image_url, pack_size, mrp,
//   in_stock, and, for a signed-in retailer with a confirmed shop only, trade_price and
//   max_orderable (omitted for everyone else, never zero).
import { storeEndpoints } from "./api.mjs";

export const MAX_QUERY_LENGTH = 100; // the API rejects q longer than 100
export const MAX_PAGE_LIMIT = 100; // and limit above 100
export const DEFAULT_LISTING_LIMIT = 24;
export const MAX_LINE_QUANTITY = 999; // one order line never exceeds 999 packets
const MAX_PAGE_NUMBER = 10000;

// A positive whole number from text or a number, else null. Leading zeros, signs, decimals and
// anything over nine digits are rejected, so a hand-edited URL cannot send a malformed id.
function toId(value) {
  if (typeof value === "number") return Number.isInteger(value) && value > 0 && value <= 999999999 ? value : null;
  if (typeof value !== "string" || !/^[1-9]\d{0,8}$/.test(value)) return null;
  return Number(value);
}

// At most 100 Unicode code points: the API counts characters, and slicing UTF-16 units could cut
// a surrogate pair in half.
function cleanQuery(value) {
  if (typeof value !== "string") return "";
  const text = value.trim();
  if (!text) return "";
  const points = Array.from(text);
  return points.length > MAX_QUERY_LENGTH ? points.slice(0, MAX_QUERY_LENGTH).join("").trim() : text;
}

function toLimit(value) {
  const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof number !== "number" || !Number.isFinite(number)) return DEFAULT_LISTING_LIMIT;
  return Math.min(MAX_PAGE_LIMIT, Math.max(1, Math.floor(number)));
}

function toOffset(value) {
  const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof number !== "number" || !Number.isFinite(number)) return 0;
  return Math.max(0, Math.floor(number));
}

/**
 * The query string for GET /store/products. q (SKU name or code), category_id and brand_id are
 * separate parameters: a brand is selected with brand_id and never searched through q.
 */
export function productQuery({ q, categoryId, brandId, limit, offset } = {}) {
  const query = new URLSearchParams();
  const category = toId(categoryId);
  const brand = toId(brandId);
  const text = cleanQuery(q);
  if (category !== null) query.set("category_id", String(category));
  if (brand !== null) query.set("brand_id", String(brand));
  if (text) query.set("q", text);
  query.set("limit", String(toLimit(limit)));
  query.set("offset", String(toOffset(offset)));
  return query.toString();
}

export const productsPath = (args) => `${storeEndpoints.products}?${productQuery(args)}`;

/**
 * The listing's filters as read from the URL (a Next searchParams object or URLSearchParams).
 * Anything unusable falls back to "no filter", so a bad link shows the full list, not an error.
 */
export function parseListingParams(input) {
  const get = (name) => {
    if (!input) return undefined;
    const value = typeof input.get === "function" ? input.get(name) : input[name];
    return Array.isArray(value) ? value[0] : value;
  };
  const page = toId(get("page"));
  return {
    q: cleanQuery(get("q")),
    categoryId: toId(get("category_id")),
    brandId: toId(get("brand_id")),
    page: page === null || page > MAX_PAGE_NUMBER ? 1 : page,
    view: get("view") === "categories" ? "categories" : null
  };
}

/** The /products URL for a set of filters: the inverse of parseListingParams. */
export function listingHref({ q, categoryId, brandId, page, view } = {}) {
  const query = new URLSearchParams();
  const category = toId(categoryId);
  const brand = toId(brandId);
  const text = cleanQuery(q);
  if (category !== null) query.set("category_id", String(category));
  if (brand !== null) query.set("brand_id", String(brand));
  if (text) query.set("q", text);
  const number = toId(page);
  if (number !== null && number > 1 && number <= MAX_PAGE_NUMBER) query.set("page", String(number));
  // The categories chooser is only the starting point: any filter replaces it.
  if (view === "categories" && category === null && brand === null && !text) query.set("view", "categories");
  const string = query.toString();
  return string ? `/products?${string}` : "/products";
}

export function pageOffset(page, limit = DEFAULT_LISTING_LIMIT) {
  const number = toId(page);
  return number === null ? 0 : (number - 1) * limit;
}

export function totalPages(total, limit = DEFAULT_LISTING_LIMIT) {
  if (!Number.isFinite(total) || total <= 0) return 1;
  return Math.max(1, Math.ceil(total / limit));
}

// ---- availability and ordering ------------------------------------------------------------

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

/** In stock and, when the server supplied a cap (retailer view), a cap above zero. */
export function isAvailable(product) {
  if (!product || product.in_stock !== true) return false;
  return product.max_orderable === undefined || product.max_orderable === null || product.max_orderable > 0;
}

/** Unavailable products stay listed, after every available one, in their original order. */
export function sortAvailableLast(items) {
  const list = Array.isArray(items) ? items : [];
  return [...list.filter(isAvailable), ...list.filter((item) => !isAvailable(item))];
}

// ---- who is looking, and what they may see --------------------------------------------------

/**
 * Maps the retailer provider state to how catalogue data is fetched and cached.
 *   mode "pending": readiness is not known yet, so nothing is fetched.
 *   mode "public":  anonymous request (anonymous, expired, or a retailer who is not ready yet).
 *   mode "private": a ready retailer; the key carries the identity generation, so a logout or an
 *                   account switch is a different key and the previous results can never be shown.
 * key "public" while the very first render is pending lets the server-rendered public seed show.
 */
export function viewerKey({ status, readiness, generation } = {}) {
  if (status === "loading") return { mode: "pending", key: "public", canPurchase: false };
  if (status === "authed") {
    if (readiness === "loading") return { mode: "pending", key: "pending", canPurchase: false };
    if (readiness === "ready") return { mode: "private", key: `private:${generation}`, canPurchase: true };
  }
  return { mode: "public", key: "public", canPurchase: false };
}

/**
 * What price to show this viewer. A trade price is shown only to a ready retailer, even if the
 * payload happens to carry one; MRP is the public price. Never a zero or a guess.
 */
export function displayPrice(product, viewer) {
  const mrp = isFiniteNumber(product?.mrp) ? product.mrp : null;
  if (viewer?.canPurchase === true) {
    const trade = isFiniteNumber(product?.trade_price) && product.trade_price > 0 ? product.trade_price : null;
    if (trade === null) return { kind: "unavailable", tradePrice: null, mrp, perPacket: false, loginPrompt: false };
    return { kind: "trade", tradePrice: trade, mrp, perPacket: true, loginPrompt: false };
  }
  return { kind: "mrp", tradePrice: null, mrp, perPacket: false, loginPrompt: true };
}

/**
 * What the purchase control may do.
 *   none/out-of-stock, none/no-price, none/no-limit: disabled, with explicit wording.
 *   gate/login: Add is shown and opens retailer login (or onboarding) and holds the add.
 *   add: whole packets up to max.
 */
export function purchaseState(product, viewer) {
  if (!isAvailable(product)) return { action: "none", reason: "out-of-stock" };
  if (!viewer?.canPurchase) return { action: "gate", reason: "login" };
  if (displayPrice(product, viewer).kind !== "trade") return { action: "none", reason: "no-price" };
  if (!Number.isInteger(product.max_orderable) || product.max_orderable < 1) {
    return { action: "none", reason: "no-limit" };
  }
  return { action: "add", max: Math.min(product.max_orderable, MAX_LINE_QUANTITY) };
}

/** A whole number of packets between 0 and max. */
export function clampQuantity(value, max) {
  const number = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(number)) return 0;
  const cap = Number.isInteger(max) && max > 0 ? Math.min(max, MAX_LINE_QUANTITY) : 0;
  return Math.min(cap, Math.max(0, Math.floor(number)));
}

/** One plus or minus step. capped is true when the quantity sits at the maximum available. */
export function stepQuantity(current, delta, max) {
  const quantity = clampQuantity((Number.isFinite(current) ? current : 0) + delta, max);
  return { quantity, capped: quantity > 0 && quantity >= clampQuantity(max, max) };
}

/**
 * A product add held across login, applied once a cart exists to take it. Until the cart slice
 * supplies one, the add stays held (null), so nothing is dropped or invented.
 */
export function decideAddResume({ intent, viewer, cartAvailable }) {
  if (!intent || intent.type !== "add" || !viewer?.canPurchase || !cartAvailable) return null;
  if (!Number.isInteger(intent.skuId) || intent.skuId < 1) return null;
  const wanted = Number.isInteger(intent.quantity) && intent.quantity > 0 ? intent.quantity : 1;
  return { skuId: intent.skuId, quantity: Math.min(wanted, MAX_LINE_QUANTITY) };
}

// ---- races -------------------------------------------------------------------------------------

/**
 * Only the most recently begun request may apply its result. begin() returns a token; check
 * isCurrent(token) when the response arrives. invalidate() drops everything in flight (identity
 * change, unmount).
 */
export function createRequestGate() {
  let latest = 0;
  return {
    begin() {
      latest += 1;
      return latest;
    },
    isCurrent(token) {
      return token === latest;
    },
    invalidate() {
      latest += 1;
    }
  };
}

// ---- related products ----------------------------------------------------------------------------

/**
 * Other products from the same listing: never the current one, never a repeat, available first.
 * The API has no related-products ranking, so this is the real category listing and nothing more.
 */
export function similarProducts(items, currentId, limit = 10) {
  const current = toId(currentId);
  const seen = new Set();
  const others = (Array.isArray(items) ? items : []).filter((item) => {
    if (!item || item.id === current || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  return sortAvailableLast(others).slice(0, limit);
}
