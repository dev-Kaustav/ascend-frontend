// Decisions for the retailer's own order history and order detail. Pure and DOM-free so that
// node:test can drive them; the views in components/store/OrderViews.jsx only render what these
// functions decide.
//
// The backend is the authority: it scopes every order and invoice to the signed-in retailer
// (another retailer's id is a 404, never data) and it owns status, totals and the Ship to
// snapshot. This module words them (D-16), orders them and refuses to believe a malformed answer.
import { storeEndpoints } from "./api.mjs";

export const ORDER_PAGE_SIZE = 20;

// The actual progression of a backend order (D-16). There are no packing, driver or ETA stages
// because the backend has none; cancelled and returned are not stages but interruptions.
export const ORDER_STAGES = Object.freeze([
  Object.freeze({ status: "PENDING", label: "Placed" }),
  Object.freeze({ status: "READY_TO_SHIP", label: "Ready to ship" }),
  Object.freeze({ status: "OUT_FOR_DELIVERY", label: "Out for delivery" }),
  Object.freeze({ status: "DELIVERED", label: "Delivered" })
]);

const INTERRUPTIONS = Object.freeze({ CANCELLED: "Cancelled", RETURNED: "Returned" });
const UNKNOWN_STATUS = "Status unavailable";

export function statusLabel(status) {
  const stage = ORDER_STAGES.find((candidate) => candidate.status === status);
  if (stage) return stage.label;
  if (typeof status === "string" && Object.hasOwn(INTERRUPTIONS, status)) return INTERRUPTIONS[status];
  return UNKNOWN_STATUS;
}

/**
 * The four actual stages with where this order is, or the interruption that replaced them.
 * stages[].state is done | current | upcoming. A cancelled or returned order shows no ladder: the
 * backend does not say how far it got, so nothing is marked complete on its behalf. An unknown
 * status shows neither, only its (unavailable) label.
 */
export function statusProgress(status) {
  if (typeof status === "string" && Object.hasOwn(INTERRUPTIONS, status)) {
    return { stages: [], interrupted: { status, label: INTERRUPTIONS[status] } };
  }
  const at = ORDER_STAGES.findIndex((stage) => stage.status === status);
  if (at < 0) return { stages: [], interrupted: null };
  return {
    stages: ORDER_STAGES.map((stage, index) => ({
      status: stage.status,
      label: stage.label,
      state: index < at ? "done" : index === at ? "current" : "upcoming"
    })),
    interrupted: null
  };
}

// ---- wording ---------------------------------------------------------------------------------------------

// item_count is the number of distinct product lines (API: len(order.items)), so it is products;
// only a detail line's quantity is a number of packets.
export function productCountLabel(count) {
  if (!Number.isInteger(count) || count < 0) return "";
  return count === 1 ? "1 product" : `${count} products`;
}

export function packetsLabel(quantity) {
  return quantity === 1 ? "1 packet" : `${quantity} packets`;
}

// No order-number field exists, so the id is the reference.
export const orderReference = (id) => `Order #${id}`;
export const orderHref = (id) => `/orders/${id}`;

export function orderSummaryLabel(order) {
  const count = productCountLabel(order?.item_count);
  return count ? `${orderReference(order?.id)} · ${count}` : orderReference(order?.id);
}

// A backend timestamp with no zone is UTC (the column is timestamptz; only a test database drops
// the zone), so it is read as UTC rather than as whatever zone the device is in.
export function parseOrderTime(value) {
  if (typeof value !== "string" || value.trim() === "") return Number.NaN;
  const text = value.trim();
  const zoned = /(?:Z|[+-]\d\d:?\d\d)$/i.test(text);
  return Date.parse(zoned ? text : `${text}Z`);
}

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export function formatOrderDate(value) {
  const at = parseOrderTime(value);
  return Number.isNaN(at) ? "" : dateFormat.format(new Date(at));
}

// ---- ordering and paging ---------------------------------------------------------------------------------

/** Newest first by the real created_at, then the higher id; undated orders last. Never mutates. */
export function sortOrdersNewest(orders) {
  return [...(Array.isArray(orders) ? orders : [])].sort((a, b) => {
    const at = parseOrderTime(a?.created_at);
    const bt = parseOrderTime(b?.created_at);
    const aKnown = !Number.isNaN(at);
    const bKnown = !Number.isNaN(bt);
    if (aKnown !== bKnown) return aKnown ? -1 : 1;
    if (aKnown && at !== bt) return bt - at;
    return (b?.id ?? 0) - (a?.id ?? 0);
  });
}

const MAX_PAGE = 999999;

export function parseOrderPage(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || !/^[1-9]\d{0,5}$/.test(raw)) return 1;
  const page = Number(raw);
  return page <= MAX_PAGE ? page : 1;
}

export function orderListPath(page) {
  return `${storeEndpoints.orders}?limit=${ORDER_PAGE_SIZE}&offset=${(page - 1) * ORDER_PAGE_SIZE}`;
}

export function totalOrderPages(total) {
  return Number.isInteger(total) && total > 0 ? Math.ceil(total / ORDER_PAGE_SIZE) : 0;
}

// The route parameter. Only a plain positive whole number that fits the backend's integer id can
// be an order; anything else never reaches the network.
export function parseOrderId(value) {
  if (typeof value !== "string" || !/^[1-9]\d{0,9}$/.test(value)) return null;
  const id = Number(value);
  return id <= 2147483647 ? id : null;
}

export function shouldRefreshOnFocus({ lastAt, now, minGap = 10000 }) {
  return lastAt === null || lastAt === undefined || now - lastAt >= minGap;
}

// ---- believing an answer ---------------------------------------------------------------------------------

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const positiveInt = (value) => Number.isInteger(value) && value > 0;
const money = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const text = (value) => (typeof value === "string" && value.trim() !== "" ? value : null);

/** { items, total } with rows newest first, or null when the answer is not the documented shape. */
export function normalizeOrderList(payload) {
  if (!isObject(payload) || !Array.isArray(payload.items)) return null;
  if (!Number.isInteger(payload.total) || payload.total < 0) return null;
  const seen = new Set();
  const items = [];
  for (const row of payload.items) {
    if (!isObject(row) || !positiveInt(row.id) || typeof row.status !== "string" || seen.has(row.id)) continue;
    seen.add(row.id);
    items.push({
      id: row.id,
      status: row.status,
      created_at: text(row.created_at),
      item_count: Number.isInteger(row.item_count) && row.item_count >= 0 ? row.item_count : null,
      total: money(row.total),
      delivery_charge: money(row.delivery_charge),
      invoice_available: row.invoice_available === true
    });
  }
  return { items: sortOrdersNewest(items), total: payload.total };
}

function normalizeShipTo(value) {
  const ship = isObject(value) ? value : {};
  const pincode = Number.isInteger(ship.pincode) ? ship.pincode : text(ship.pincode);
  return {
    label: text(ship.label),
    line1: text(ship.line1),
    line2: text(ship.line2),
    landmark: text(ship.landmark),
    city: text(ship.city),
    state: text(ship.state),
    pincode
  };
}

/** The order detail the views may show, or null when the answer is not an order. */
export function normalizeOrderDetail(payload) {
  if (!isObject(payload) || !positiveInt(payload.id) || typeof payload.status !== "string" || !Array.isArray(payload.lines)) {
    return null;
  }
  const lines = [];
  for (const line of payload.lines) {
    if (!isObject(line) || !positiveInt(line.sku_id) || !positiveInt(line.quantity)) continue;
    lines.push({
      sku_id: line.sku_id,
      name: text(line.name),
      image_url: text(line.image_url),
      pack_size: text(line.pack_size),
      quantity: line.quantity,
      line_total: money(line.line_total)
    });
  }
  return {
    id: payload.id,
    status: payload.status,
    created_at: text(payload.created_at),
    lines,
    subtotal: money(payload.subtotal),
    delivery_charge: money(payload.delivery_charge),
    total: money(payload.total),
    ship_to: normalizeShipTo(payload.ship_to),
    invoice_available: payload.invoice_available === true
  };
}

/** The order's own Ship to snapshot as a label and wrapped lines. Empty when none was recorded. */
export function formatShipTo(shipTo) {
  const ship = normalizeShipTo(shipTo);
  const place = [ship.city, ship.state].filter(Boolean).join(", ");
  const lastLine = [place, ship.pincode === null ? "" : String(ship.pincode)].filter(Boolean).join(" ");
  return {
    label: ship.label,
    lines: [ship.line1, ship.line2, ship.landmark ? `Landmark: ${ship.landmark}` : null, lastLine || null].filter(Boolean)
  };
}

// ---- failure is not emptiness ----------------------------------------------------------------------------

/**
 * How a failed read is told to the retailer. subject is "orders" (the list) or "order".
 * kind: "stale" (ignore it), "signed-out" (the sign-in sheet handles it), "unavailable" (the
 * server answered 404: missing and someone else's are indistinguishable by design) or "failed"
 * (retry locally; never shown as an empty list).
 */
export function describeOrderError(error, subject = "order") {
  if (error?.reason === "stale") return { kind: "stale", message: "" };
  if (error?.reason === "session-expired" || error?.reason === "needs-login" || error?.status === 401) {
    return { kind: "signed-out", message: "Your session ended. Log in again to see your orders." };
  }
  if (error?.status === 404) return { kind: "unavailable", message: "This order isn't available." };
  if (error?.reason === "network") {
    return { kind: "failed", message: "We couldn't reach the store. Check your connection and try again." };
  }
  return { kind: "failed", message: `We couldn't load your ${subject === "orders" ? "orders" : "order"}. Please try again.` };
}
