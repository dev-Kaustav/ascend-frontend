// Cart decisions for the storefront. Pure: storage and the clock are passed in, nothing here imports
// React or touches the network, so it runs under plain Node for tests.
//
// What a cart is (D-11): the retailer's intent, nothing else. A line is { sku_id, quantity } with a
// whole number of packets. No price, name, address or total is ever stored or computed here; every
// rupee on screen comes from a server quote that is checked against the current cart revision and
// the current identity before it is believed (quoteMatchesCart). Stored values are untrusted input
// (T-09-07-1/2): a different retailer's key is never read, and each line is validated on the way in.
import { MAX_LINE_QUANTITY } from "./catalogue.mjs";

export { MAX_LINE_QUANTITY };
export const MAX_CART_LINES = 50;

const isSkuId = (value) => Number.isInteger(value) && value >= 1;

function freezeCart(lines, revision) {
  return Object.freeze({ lines: Object.freeze(lines.map((line) => Object.freeze({ ...line }))), revision });
}

export const emptyCart = (revision = 0) => freezeCart([], revision);

/** Whole packets between 1 and 999, or 0 when the value cannot be a purchase. */
function wholePackets(value, cap = MAX_LINE_QUANTITY) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  const limit = Number.isInteger(cap) && cap >= 0 ? Math.min(cap, MAX_LINE_QUANTITY) : MAX_LINE_QUANTITY;
  return Math.min(limit, Math.max(0, Math.floor(value)));
}

// ---- storage ----------------------------------------------------------------------------------------

/** The key a retailer's cart lives under, or null when there is no valid retailer. */
export function cartStorageKey(retailerId) {
  const id = typeof retailerId === "string" && /^[0-9]+$/.test(retailerId) ? Number(retailerId) : retailerId;
  return isSkuId(id) ? `ascend_store_cart:${id}` : null;
}

/**
 * The cart a stored string describes. Anything malformed is an empty cart. Lines are kept in order
 * and only when valid: a positive integer id, a whole number of packets above zero (over 999 is
 * clamped), no repeat of an id, at most 50 lines. revision is supplied by the caller so a newly
 * restored cart never reuses a revision an earlier quote was asked for.
 */
export function restoreCart(raw, revision = 0) {
  if (typeof raw !== "string" || raw === "") return emptyCart(revision);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyCart(revision);
  }
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.lines)) return emptyCart(revision);
  const lines = [];
  const seen = new Set();
  for (const entry of parsed.lines) {
    if (lines.length >= MAX_CART_LINES) break;
    if (!entry || typeof entry !== "object") continue;
    const { sku_id: skuId, quantity } = entry;
    if (!isSkuId(skuId) || seen.has(skuId)) continue;
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) continue;
    seen.add(skuId);
    lines.push({ sku_id: skuId, quantity: Math.min(quantity, MAX_LINE_QUANTITY) });
  }
  return freezeCart(lines, revision);
}

/** What is written to storage: ids and quantities only, or null for an empty cart. */
export function serializeCart(cart) {
  if (!cart || cart.lines.length === 0) return null;
  return JSON.stringify({ lines: cart.lines.map(({ sku_id, quantity }) => ({ sku_id, quantity })) });
}

export function readStoredCart(storage, retailerId, revision = 0) {
  const key = cartStorageKey(retailerId);
  if (!key || !storage) return emptyCart(revision);
  try {
    return restoreCart(storage.getItem(key), revision);
  } catch {
    return emptyCart(revision);
  }
}

export function writeStoredCart(storage, retailerId, cart) {
  const key = cartStorageKey(retailerId);
  if (!key || !storage) return;
  try {
    const text = serializeCart(cart);
    if (text === null) storage.removeItem(key);
    else storage.setItem(key, text);
  } catch {
    // Storage that refuses writes only means the cart is not remembered across a reload.
  }
}

// ---- changes ----------------------------------------------------------------------------------------

export function cartQuantity(cart, skuId) {
  return cart?.lines.find((line) => line.sku_id === skuId)?.quantity ?? 0;
}

/**
 * Sets a line to a whole number of packets (floored, at most 999 and at most max when given).
 * Under one packet, or anything that is not a number, removes the line. A change that does nothing
 * returns the same cart, so it is not re-quoted. Adding a 51st distinct line is refused.
 */
export function updateCartQuantity(cart, skuId, quantity, max) {
  if (!isSkuId(skuId)) return cart;
  const next = wholePackets(quantity, max === undefined ? MAX_LINE_QUANTITY : max);
  const index = cart.lines.findIndex((line) => line.sku_id === skuId);
  if (next < 1) return index === -1 ? cart : removeCartLine(cart, skuId);
  if (index === -1) {
    if (cart.lines.length >= MAX_CART_LINES) return cart;
    return freezeCart([...cart.lines, { sku_id: skuId, quantity: next }], cart.revision + 1);
  }
  if (cart.lines[index].quantity === next) return cart;
  const lines = cart.lines.map((line, at) => (at === index ? { sku_id: skuId, quantity: next } : line));
  return freezeCart(lines, cart.revision + 1);
}

export function removeCartLine(cart, skuId) {
  if (!cart.lines.some((line) => line.sku_id === skuId)) return cart;
  return freezeCart(
    cart.lines.filter((line) => line.sku_id !== skuId),
    cart.revision + 1
  );
}

/** Packets in the cart: every line's quantity added up. */
export const cartUnitCount = (cart) => (cart?.lines ?? []).reduce((total, line) => total + line.quantity, 0);

/** POST /store/cart/quote carries the lines and nothing else (no price, address or identity). */
export function quoteRequestBody(cart) {
  return { items: cart.lines.map(({ sku_id, quantity }) => ({ sku_id, quantity })) };
}

// ---- a quote only counts for the cart and identity it was asked for ----------------------------------

const sameIdentity = (a, b) => Boolean(a && b) && a.generation === b.generation && a.retailerId === b.retailerId;

function linesAgree(cart, quote) {
  if (!quote || !Array.isArray(quote.lines) || quote.lines.length !== cart.lines.length) return false;
  return cart.lines.every((line) => quote.lines.some((priced) => priced.sku_id === line.sku_id && priced.quantity === line.quantity));
}

/**
 * record: { phase: "ready", identity: { generation, retailerId }, revision, quote }, the answer to a
 * request made for one revision of one retailer's cart under one session generation. True only while
 * that is still the cart on screen and the quote prices exactly its lines. Anything else is stale.
 */
export function quoteMatchesCart(record, cart, identity) {
  if (!record || record.phase !== "ready" || !cart) return false;
  if (!sameIdentity(record.identity, identity) || record.revision !== cart.revision) return false;
  return linesAgree(cart, record.quote);
}

// ---- stock review -----------------------------------------------------------------------------------

/** The quoted lines that do not fit the stock now: what the retailer must review. */
export function stockLines(quote) {
  if (!quote || !Array.isArray(quote.lines)) return [];
  return quote.lines
    .filter((line) => line.within_stock === false)
    .map((line) => ({
      sku_id: line.sku_id,
      name: line.name ?? null,
      quantity: line.quantity,
      max_orderable: Number.isInteger(line.max_orderable) && line.max_orderable > 0 ? line.max_orderable : 0
    }));
}

// ---- what the cart can do right now ---------------------------------------------------------------------

/**
 * state: "empty" | "updating" | "error" | "stock" | "ready".
 * Only "ready" means the displayed totals are current: a quote for this exact cart revision and
 * identity, every line within stock. record is the latest quote request outcome.
 */
export function cartReadiness({ cart, identity, record }) {
  if (!cart || cart.lines.length === 0) return { state: "empty", ready: false, quote: null, stock: [] };
  const sameAsk = record && sameIdentity(record.identity, identity) && record.revision === cart.revision;
  if (!sameAsk) return { state: "updating", ready: false, quote: null, stock: [] };
  if (record.phase === "error") return { state: "error", ready: false, quote: null, stock: [] };
  if (record.phase !== "ready") return { state: "updating", ready: false, quote: null, stock: [] };
  if (!quoteMatchesCart(record, cart, identity)) return { state: "error", ready: false, quote: null, stock: [] };
  const stock = stockLines(record.quote);
  if (stock.length > 0) return { state: "stock", ready: false, quote: record.quote, stock };
  return { state: "ready", ready: true, quote: record.quote, stock: [] };
}
