// Pure catalogue decisions for the storefront. No React, no network, no browser globals, so
// node:test runs the real code (tests/store-catalogue.test.mjs).
//
// The backend is the authority for prices, availability and caps. Nothing here invents data: it
// decides what to ask for, which viewer may see which price, which request result may win, and
// how a list is ordered. Product shape (see ascend-backend/app/schemas/store.py, StoreProduct):
//   id, code, name, brand{id,name}, category{id,name,icon_url}, image_url, pack_size, pack_type,
//   units_per_pack, mrp, trade_price, in_stock, the same for every viewer. Before that,, for a signed-in retailer with a confirmed shop only, trade_price and
//   max_orderable (omitted for everyone else, never zero).
import { storeEndpoints } from "./api.mjs";

export const MAX_QUERY_LENGTH = 100; // the API rejects q longer than 100
export const MAX_PAGE_LIMIT = 100; // and limit above 100
export const DEFAULT_LISTING_LIMIT = 24;
export const MAX_LINE_QUANTITY = 999; // one order line never exceeds 999 pieces
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

/** A product id from a route segment: a positive whole number, else null. */
export const parseProductId = (value) => toId(value);

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
 * What price to show. Trade prices are public: anyone can price a cart before logging in, and login
 * and shop details are asked for at Place order. Never a zero or a guess.
 */
export function displayPrice(product) {
  const mrp = isFiniteNumber(product?.mrp) ? product.mrp : null;
  const trade = isFiniteNumber(product?.trade_price) && product.trade_price > 0 ? product.trade_price : null;
  if (trade === null) return { kind: "unavailable", tradePrice: null, mrp };
  return { kind: "trade", tradePrice: trade, mrp };
}

/**
 * What the purchase control may do, for any visitor.
 *   none/out-of-stock, none/no-price: disabled, with explicit wording.
 *   add: whole packs up to the per-line limit. No stock count is shown or used: a shortage is
 *        trimmed by the stock review at checkout.
 */
export function purchaseState(product) {
  if (!isAvailable(product)) return { action: "none", reason: "out-of-stock" };
  if (displayPrice(product).kind !== "trade") return { action: "none", reason: "no-price" };
  return { action: "add", max: MAX_LINE_QUANTITY };
}

// ---- packs (ladi) ----------------------------------------------------------------------------
// Quantities are always pieces. A product with units_per_pack > 1 is sold only in whole packs of
// that many pieces (a ladi), so the controls step by a pack and show both counts.

/** { size, name }: pieces in one pack and the pack's word ("ladi"), or size 1 and null for loose pieces. */
export function packOf(item) {
  const size = Number.isInteger(item?.units_per_pack) && item.units_per_pack > 1 ? item.units_per_pack : 1;
  return { size, name: size > 1 ? (typeof item?.pack_type === "string" && item.pack_type ? item.pack_type : "pack") : null };
}

export const piecesLabel = (pieces) => `${pieces} ${pieces === 1 ? "pc" : "pcs"}`;

/** "2 ladi · 24 pcs" for a pack product, "24 pcs" for loose pieces (or a quantity that is not whole packs). */
export function quantityLabel(pieces, item) {
  const { size, name } = packOf(item);
  if (size === 1 || pieces % size !== 0) return piecesLabel(pieces);
  return `${pieces / size} ${name} · ${piecesLabel(pieces)}`;
}

/** A whole number of packs, in pieces, between 0 and max. step is the pack size in pieces. */
export function clampQuantity(value, max, step = 1) {
  const number = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(number)) return 0;
  const size = Number.isInteger(step) && step > 1 ? step : 1;
  const limit = Number.isInteger(max) && max > 0 ? Math.min(max, MAX_LINE_QUANTITY) : 0;
  const cap = limit - (limit % size);
  return Math.min(cap, Math.max(0, Math.floor(number / size) * size));
}

/** One plus or minus pack. capped is true when the quantity sits at the maximum available. */
export function stepQuantity(current, delta, max, step = 1) {
  const size = Number.isInteger(step) && step > 1 ? step : 1;
  const base = clampQuantity(Number.isFinite(current) ? current : 0, MAX_LINE_QUANTITY, size);
  const quantity = clampQuantity(base + delta * size, max, size);
  return { quantity, capped: quantity > 0 && quantity >= clampQuantity(max, max, size) };
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

// ---- the home: real shelves from the real catalogue --------------------------------------------------

export const FEATURE_BRAND_NAME = "Jabsons";
export const HOME_SHELF_LIMIT = 10;
export const HOME_MAX_PAGES = 5; // 500 products at most; a bound, not a target

/**
 * Reads the whole catalogue a page at a time (limit 100 each) for the home's shelves and full
 * range. Stops when everything is read, when a page comes back short or empty, after maxPages, or
 * as soon as isCurrent() says the result is no longer wanted, so it can never loop on its own.
 * Returns { items, total, complete } or null when it was abandoned.
 */
export async function loadProductPages(fetchPage, { limit = MAX_PAGE_LIMIT, maxPages = HOME_MAX_PAGES, isCurrent = () => true } = {}) {
  const items = [];
  const seen = new Set();
  let total = 0;
  for (let page = 0; page < maxPages; page += 1) {
    const result = await fetchPage({ limit, offset: page * limit });
    if (!isCurrent()) return null;
    const batch = Array.isArray(result?.items) ? result.items : [];
    if (Number.isFinite(result?.total)) total = result.total;
    for (const item of batch) {
      if (item && !seen.has(item.id)) {
        seen.add(item.id);
        items.push(item);
      }
    }
    if (batch.length < limit || items.length >= total) break;
  }
  return { items, total: Math.max(total, items.length), complete: items.length >= total };
}

/**
 * One shelf per real category that holds at least one product, in the API's category order, each
 * with at most perShelf products (available first). A category with no products produces no
 * shelf, and no product is repeated to fill one.
 */
export function groupShelves(products, categories, perShelf = HOME_SHELF_LIMIT) {
  const list = Array.isArray(products) ? products : [];
  return (Array.isArray(categories) ? categories : [])
    .map((category) => {
      const inCategory = list.filter((product) => product?.category?.id === category.id);
      return { category, total: inCategory.length, products: sortAvailableLast(inCategory).slice(0, perShelf) };
    })
    .filter((shelf) => shelf.products.length > 0);
}

/**
 * One real pack shot per category for its home tile: the first https image among that category's
 * products, in-stock ones first. A category with no usable image is simply absent from the map.
 */
export function categoryCovers(products) {
  const covers = {};
  for (const product of sortAvailableLast(Array.isArray(products) ? products : [])) {
    const id = product?.category?.id;
    const url = product?.image_url;
    if (id != null && covers[id] === undefined && typeof url === "string" && url.startsWith("https://")) {
      covers[id] = url;
    }
  }
  return covers;
}

/**
 * The brand to feature, found by the name the API returned (never a hard-coded database id), with
 * its real product count and up to three distinct real product images. null when it is absent.
 */
export function findFeatureBrand(brands, products, name = FEATURE_BRAND_NAME) {
  const wanted = String(name).trim().toLowerCase();
  const brand = (Array.isArray(brands) ? brands : []).find((item) => String(item?.name).trim().toLowerCase() === wanted);
  if (!brand) return null;
  const own = sortAvailableLast((Array.isArray(products) ? products : []).filter((product) => product?.brand?.id === brand.id));
  const thumbs = [];
  for (const product of own) {
    const url = product.image_url;
    if (typeof url === "string" && url.startsWith("https://") && !thumbs.includes(url)) thumbs.push(url);
    if (thumbs.length === 3) break;
  }
  return { brand, count: own.length, thumbs };
}

// ---- returning to where you were -------------------------------------------------------------------------

const routeKeyOf = (pathname, search = "") => `${pathname}${search}`.slice(0, 2200);
export { routeKeyOf };

const isCoordinate = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 10000000;

/**
 * Remembers scroll position per route (path plus query), and the horizontal position of each shelf
 * on it. Backed by an optional Storage (sessionStorage) so it survives a reload; any storage
 * failure only loses persistence, never the in-memory memory. Bounded to `limit` routes.
 */
export function createPositionMemory({ storage = null, key = "ascend_store_positions", limit = 40 } = {}) {
  let entries = null;
  const load = () => {
    if (entries) return entries;
    entries = new Map();
    try {
      const parsed = JSON.parse(storage?.getItem(key) || "[]");
      for (const [route, position] of Array.isArray(parsed) ? parsed.slice(-limit) : []) {
        const clean = sanitise(position);
        if (typeof route === "string" && route.length <= 2200 && clean) entries.set(route, clean);
      }
    } catch {
      // unreadable or unavailable storage: start empty
    }
    return entries;
  };
  function sanitise(position) {
    if (!position || !isCoordinate(position.y)) return null;
    const shelves = {};
    for (const [id, x] of Object.entries(position.shelves && typeof position.shelves === "object" ? position.shelves : {}).slice(0, 20)) {
      if (id.length <= 80 && isCoordinate(x)) shelves[id] = x;
    }
    return { y: position.y, shelves };
  }
  return {
    get(route) {
      return load().get(route) || null;
    },
    set(route, position) {
      const clean = sanitise(position);
      if (!clean || typeof route !== "string") return;
      const map = load();
      map.delete(route);
      map.set(route, clean);
      while (map.size > limit) map.delete(map.keys().next().value);
    },
    persist() {
      try {
        storage?.setItem(key, JSON.stringify([...load()]));
      } catch {
        // storage full or blocked: the in-memory copy still works
      }
    }
  };
}

/**
 * Tells a browser Back/Forward arrival from a fresh navigation. Only an arrival by history
 * traversal restores a remembered position; a fresh link, a direct URL or a reload does not.
 * The mark expires, so a stale traversal (for example closing a sheet with Back) cannot restore
 * a position for some later unrelated navigation.
 */
export function createTraversalTracker(now = Date.now, ttl = 10000) {
  let at = null;
  return {
    markTraversal() {
      at = now();
    },
    markNavigation() {
      at = null;
    },
    consume() {
      const fresh = at !== null && now() - at <= ttl;
      at = null;
      return fresh;
    }
  };
}
