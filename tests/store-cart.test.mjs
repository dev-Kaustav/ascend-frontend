// Behaviour tests for the storefront cart decisions. node:test, no framework, no network:
//
//   node --test tests/store-cart.test.mjs
//
// Every test drives the real exports from lib/store/cart.mjs. The module keeps only what the
// retailer asked for (SKU ids and whole-packet quantities) and decides when a server quote may be
// trusted. It never holds a price: every rupee on screen comes from the quote the server returned
// for the current cart and the current identity.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_CART_LINES,
  MAX_LINE_QUANTITY,
  acceptStockChanges,
  cartBarSummary,
  cartQuantity,
  cartReadiness,
  cartStorageKey,
  describeQuoteError,
  emptyCart,
  freeDeliveryRemaining,
  quoteMatchesCart,
  quoteRequestBody,
  readStoredCart,
  removeCartLine,
  removeCartLines,
  restoreCart,
  serializeCart,
  stockLines,
  updateCartQuantity,
  writeStoredCart
} from "../lib/store/cart.mjs";

const memoryStorage = (initial = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    dump: () => Object.fromEntries(data)
  };
};

const cartOf = (...pairs) => pairs.reduce((cart, [skuId, quantity]) => updateCartQuantity(cart, skuId, quantity), emptyCart());

// ---- one real SKU survives serialization, for one owner only ---------------------------------------

test("one SKU and quantity survive serialize then restore", () => {
  const cart = cartOf([12, 3]);
  const text = serializeCart(cart);
  const restored = restoreCart(text);
  assert.deepEqual(restored.lines, [{ sku_id: 12, quantity: 3 }]);
});

test("what is stored is only SKU ids and quantities: no price, name, address or total", () => {
  const text = serializeCart(cartOf([12, 3], [40, 1]));
  const parsed = JSON.parse(text);
  assert.deepEqual(Object.keys(parsed), ["lines"]);
  for (const line of parsed.lines) assert.deepEqual(Object.keys(line).sort(), ["quantity", "sku_id"]);
});

test("an empty cart serializes to nothing, so its key can be removed", () => {
  assert.equal(serializeCart(emptyCart()), null);
});

test("the storage key names the retailer; no retailer, no key", () => {
  assert.equal(cartStorageKey(6), "ascend_store_cart:6");
  assert.equal(cartStorageKey("7"), "ascend_store_cart:7");
  assert.equal(cartStorageKey(null), null);
  assert.equal(cartStorageKey(undefined), null);
  assert.equal(cartStorageKey(0), null);
  assert.equal(cartStorageKey(-3), null);
  assert.equal(cartStorageKey("../x"), null);
});

test("a cart written for one retailer is never read back for another", () => {
  const storage = memoryStorage();
  writeStoredCart(storage, 6, cartOf([12, 3]));
  assert.deepEqual(readStoredCart(storage, 6).lines, [{ sku_id: 12, quantity: 3 }]);
  assert.deepEqual(readStoredCart(storage, 7).lines, []);
  assert.deepEqual(readStoredCart(storage, null).lines, []);
  assert.deepEqual(Object.keys(storage.dump()), ["ascend_store_cart:6"]);
});

test("writing an empty cart removes the owner's key", () => {
  const storage = memoryStorage();
  writeStoredCart(storage, 6, cartOf([12, 3]));
  writeStoredCart(storage, 6, removeCartLine(cartOf([12, 3]), 12));
  assert.deepEqual(storage.dump(), {});
});

test("storage that throws or is missing is an empty cart, never a crash", () => {
  const broken = {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("denied");
    },
    removeItem() {
      throw new Error("denied");
    }
  };
  assert.deepEqual(readStoredCart(broken, 6).lines, []);
  assert.deepEqual(readStoredCart(null, 6).lines, []);
  assert.doesNotThrow(() => writeStoredCart(broken, 6, cartOf([1, 1])));
  assert.doesNotThrow(() => writeStoredCart(null, 6, cartOf([1, 1])));
});

// ---- integer, cap and removal rules ------------------------------------------------------------------

test("quantities are whole packets: zero, negative and non-numbers remove the line", () => {
  const base = cartOf([5, 2]);
  for (const bad of [0, -1, Number.NaN, Infinity, "3", null, undefined]) {
    assert.deepEqual(updateCartQuantity(base, 5, bad).lines, [], `quantity ${String(bad)} removes`);
  }
});

test("a fractional quantity is floored to whole packets, and under one removes", () => {
  assert.deepEqual(updateCartQuantity(emptyCart(), 5, 2.9).lines, [{ sku_id: 5, quantity: 2 }]);
  assert.deepEqual(updateCartQuantity(cartOf([5, 2]), 5, 0.4).lines, []);
});

test("a line never exceeds 999 packets", () => {
  assert.equal(MAX_LINE_QUANTITY, 999);
  assert.equal(updateCartQuantity(emptyCart(), 5, 5000).lines[0].quantity, 999);
});

test("a cap given by the caller (max_orderable) limits the quantity; a zero cap adds nothing", () => {
  assert.equal(updateCartQuantity(emptyCart(), 5, 10, 4).lines[0].quantity, 4);
  const none = updateCartQuantity(emptyCart(), 5, 1, 0);
  assert.deepEqual(none.lines, []);
});

test("the cart holds at most 50 distinct lines; an existing line can still change", () => {
  assert.equal(MAX_CART_LINES, 50);
  let cart = emptyCart();
  for (let id = 1; id <= 50; id += 1) cart = updateCartQuantity(cart, id, 1);
  assert.equal(cart.lines.length, 50);
  const refused = updateCartQuantity(cart, 51, 1);
  assert.equal(refused.lines.length, 50);
  assert.equal(refused, cart, "a refused add returns the same cart, so nothing is re-quoted");
  const changed = updateCartQuantity(cart, 7, 9);
  assert.equal(cartQuantity(changed, 7), 9);
});

test("an invalid SKU id is ignored", () => {
  for (const bad of [0, -1, 1.5, "2", null, undefined, Number.NaN]) {
    const next = updateCartQuantity(emptyCart(), bad, 2);
    assert.deepEqual(next.lines, [], `sku ${String(bad)}`);
  }
});

test("setting the quantity a line already has changes nothing and keeps the revision", () => {
  const cart = cartOf([5, 2]);
  assert.equal(updateCartQuantity(cart, 5, 2), cart);
  assert.equal(removeCartLine(cart, 99), cart);
});

test("every real change moves the revision on, and the earlier cart is untouched", () => {
  const first = updateCartQuantity(emptyCart(), 5, 1);
  const second = updateCartQuantity(first, 5, 2);
  const third = removeCartLine(second, 5);
  assert.ok(first.revision > 0);
  assert.ok(second.revision > first.revision);
  assert.ok(third.revision > second.revision);
  assert.deepEqual(first.lines, [{ sku_id: 5, quantity: 1 }]);
  assert.throws(() => {
    "use strict";
    first.lines.push({ sku_id: 9, quantity: 1 });
  }, TypeError);
});

test("removeCartLine drops only that line", () => {
  const cart = cartOf([5, 2], [6, 1]);
  assert.deepEqual(removeCartLine(cart, 5).lines, [{ sku_id: 6, quantity: 1 }]);
});

// ---- malformed storage -------------------------------------------------------------------------------

test("malformed storage is an empty cart", () => {
  for (const raw of [null, undefined, "", "not json", "[]", "null", "42", '"x"', "{}", '{"lines":"nope"}', '{"lines":{}}']) {
    assert.deepEqual(restoreCart(raw).lines, [], `raw ${String(raw)}`);
  }
});

test("restore keeps only valid lines: positive integer ids, whole quantities, no duplicates", () => {
  const raw = JSON.stringify({
    lines: [
      { sku_id: 1, quantity: 2 },
      { sku_id: 1, quantity: 9 },
      { sku_id: 2, quantity: 0 },
      { sku_id: 3, quantity: -4 },
      { sku_id: 4, quantity: 1.5 },
      { sku_id: "5", quantity: 1 },
      { sku_id: 6, quantity: "2" },
      { sku_id: 7 },
      null,
      7,
      { sku_id: 8, quantity: 5000 },
      { sku_id: 9, quantity: 3, price: 1, name: "ignored" }
    ]
  });
  assert.deepEqual(restoreCart(raw).lines, [
    { sku_id: 1, quantity: 2 },
    { sku_id: 8, quantity: 999 },
    { sku_id: 9, quantity: 3 }
  ]);
});

test("restore never yields more than 50 lines", () => {
  const lines = Array.from({ length: 80 }, (_, index) => ({ sku_id: index + 1, quantity: 1 }));
  assert.equal(restoreCart(JSON.stringify({ lines })).lines.length, 50);
});

test("restore takes the revision it is given, so a new owner never reuses an older one", () => {
  assert.equal(restoreCart(null, 7).revision, 7);
  assert.equal(restoreCart(serializeCart(cartOf([1, 1])), 9).revision, 9);
});

// ---- request body: items only --------------------------------------------------------------------------

test("the quote request carries items and nothing else", () => {
  const body = quoteRequestBody(cartOf([12, 3], [40, 1]));
  assert.deepEqual(body, {
    items: [
      { sku_id: 12, quantity: 3 },
      { sku_id: 40, quantity: 1 }
    ]
  });
  assert.deepEqual(Object.keys(body), ["items"]);
});

// ---- a quote only counts for the cart and identity it was asked for ----------------------------------

const identity = { generation: 4, retailerId: 6 };
const quoteFor = (cart, extra = {}) => ({
  lines: cart.lines.map((line) => ({
    sku_id: line.sku_id,
    quantity: line.quantity,
    mrp: 10,
    trade_price: 8,
    line_total: 8 * line.quantity,
    max_orderable: 100,
    within_stock: true
  })),
  subtotal: 100,
  delivery_charge: 0,
  free_delivery_above: null,
  total: 100,
  ...extra
});
const recordFor = (cart, quote, over = {}) => ({ phase: "ready", identity, revision: cart.revision, quote, ...over });

test("a quote for this cart revision, identity and lines matches", () => {
  const cart = cartOf([12, 3]);
  assert.equal(quoteMatchesCart(recordFor(cart, quoteFor(cart)), cart, identity), true);
});

test("a newer cart revision rejects the earlier quote", () => {
  const cart = cartOf([12, 3]);
  const record = recordFor(cart, quoteFor(cart));
  const later = updateCartQuantity(cart, 12, 4);
  assert.equal(quoteMatchesCart(record, later, identity), false);
});

test("a different session generation or retailer rejects the quote", () => {
  const cart = cartOf([12, 3]);
  const record = recordFor(cart, quoteFor(cart));
  assert.equal(quoteMatchesCart(record, cart, { generation: 5, retailerId: 6 }), false);
  assert.equal(quoteMatchesCart(record, cart, { generation: 4, retailerId: 7 }), false);
  assert.equal(quoteMatchesCart(record, cart, null), false);
});

test("a quote whose lines differ from the cart's is not a quote of this cart", () => {
  const cart = cartOf([12, 3]);
  const other = cartOf([12, 2]);
  assert.equal(quoteMatchesCart(recordFor(cart, quoteFor(other)), cart, identity), false);
  const missing = quoteFor(cart);
  missing.lines = [];
  assert.equal(quoteMatchesCart(recordFor(cart, missing), cart, identity), false);
});

test("no record, an error record or a malformed quote never matches", () => {
  const cart = cartOf([12, 3]);
  assert.equal(quoteMatchesCart(null, cart, identity), false);
  assert.equal(quoteMatchesCart(recordFor(cart, null), cart, identity), false);
  assert.equal(quoteMatchesCart(recordFor(cart, quoteFor(cart), { phase: "error" }), cart, identity), false);
  assert.equal(quoteMatchesCart(recordFor(cart, { lines: "x" }), cart, identity), false);
});

// ---- within_stock false is an explicit review state ---------------------------------------------------

test("a current quote with every line in stock is the only ready state", () => {
  const cart = cartOf([12, 3]);
  const state = cartReadiness({ cart, identity, record: recordFor(cart, quoteFor(cart)) });
  assert.equal(state.state, "ready");
  assert.equal(state.ready, true);
});

test("within_stock false is a stock review, never ready, and names what is short", () => {
  const cart = cartOf([12, 3], [40, 1]);
  const quote = quoteFor(cart);
  quote.lines[0] = { ...quote.lines[0], within_stock: false, max_orderable: 2, name: "Short snack" };
  quote.lines[1] = { ...quote.lines[1], within_stock: false, max_orderable: 0 };
  const state = cartReadiness({ cart, identity, record: recordFor(cart, quote) });
  assert.equal(state.state, "stock");
  assert.equal(state.ready, false);
  assert.deepEqual(state.stock, [
    { sku_id: 12, name: "Short snack", quantity: 3, max_orderable: 2 },
    { sku_id: 40, name: null, quantity: 1, max_orderable: 0 }
  ]);
  assert.ok(state.quote, "the quote stays available so the lines can be shown");
});

test("stockLines reads only within_stock false and never invents a cap", () => {
  assert.deepEqual(stockLines(null), []);
  assert.deepEqual(stockLines({ lines: "x" }), []);
  const lines = stockLines({
    lines: [
      { sku_id: 1, quantity: 1, within_stock: true, max_orderable: 5 },
      { sku_id: 2, quantity: 4, within_stock: false, max_orderable: -3 },
      { sku_id: 3, quantity: 4, within_stock: false, max_orderable: 2.5 }
    ]
  });
  assert.deepEqual(
    lines.map((line) => [line.sku_id, line.max_orderable]),
    [
      [2, 0],
      [3, 0]
    ]
  );
});

test("an earlier quote never makes a changed cart ready", () => {
  const cart = cartOf([12, 3]);
  const record = recordFor(cart, quoteFor(cart));
  const changed = updateCartQuantity(cart, 12, 4);
  const state = cartReadiness({ cart: changed, identity, record });
  assert.equal(state.state, "updating");
  assert.equal(state.ready, false);
  assert.equal(state.quote, null, "the earlier quote's totals are not exposed");
});

test("a quote for another identity or an error is never ready", () => {
  const cart = cartOf([12, 3]);
  const record = recordFor(cart, quoteFor(cart));
  assert.equal(cartReadiness({ cart, identity: { generation: 9, retailerId: 6 }, record }).ready, false);
  assert.equal(cartReadiness({ cart, identity, record: { ...record, phase: "error", quote: null } }).state, "error");
  assert.equal(cartReadiness({ cart, identity, record: { ...record, phase: "updating", quote: null } }).state, "updating");
  assert.equal(cartReadiness({ cart, identity, record: null }).state, "updating");
});

test("a server quote that does not price the cart's lines is an error, not a total", () => {
  const cart = cartOf([12, 3]);
  const wrong = recordFor(cart, quoteFor(cartOf([12, 2])));
  assert.equal(cartReadiness({ cart, identity, record: wrong }).state, "error");
});

test("an empty cart is empty whatever the record says", () => {
  const cart = cartOf([12, 3]);
  const record = recordFor(cart, quoteFor(cart));
  assert.equal(cartReadiness({ cart: emptyCart(), identity, record }).state, "empty");
  assert.equal(cartReadiness({ cart: null, identity, record }).state, "empty");
});

// ---- accepting a shortage is explicit, and exact ---------------------------------------------------------

const shortQuote = (cart, shortages) => {
  const quote = quoteFor(cart);
  quote.lines = quote.lines.map((line) => (shortages[line.sku_id] === undefined ? line : { ...line, within_stock: false, max_orderable: shortages[line.sku_id] }));
  return quote;
};

test("accepting a shortage lowers short lines to what is available and removes sold-out ones", () => {
  const cart = cartOf([12, 5], [40, 2], [77, 9]);
  const next = acceptStockChanges(cart, shortQuote(cart, { 12: 3, 40: 0 }));
  assert.deepEqual(next.lines, [
    { sku_id: 12, quantity: 3 },
    { sku_id: 77, quantity: 9 }
  ]);
  assert.ok(next.revision > cart.revision, "the changed cart is a new revision, so it is re-quoted");
});

test("accepting changes nothing when nothing is short, and does not touch other lines", () => {
  const cart = cartOf([12, 5]);
  assert.equal(acceptStockChanges(cart, quoteFor(cart)), cart);
  assert.equal(acceptStockChanges(cart, null), cart);
});

test("removeCartLines drops exactly the named products and ignores unknown ones", () => {
  const cart = cartOf([1, 1], [2, 2], [3, 3]);
  assert.deepEqual(removeCartLines(cart, [2, 99]).lines, [
    { sku_id: 1, quantity: 1 },
    { sku_id: 3, quantity: 3 }
  ]);
  assert.equal(removeCartLines(cart, [99]), cart);
  assert.equal(removeCartLines(cart, "nope"), cart);
});

// ---- free delivery, in rupees from the server's own numbers ---------------------------------------------

test("free-delivery progress is the threshold minus the server's subtotal, in rupees", () => {
  assert.equal(freeDeliveryRemaining({ subtotal: 320.5, free_delivery_above: 500 }), 179.5);
  assert.equal(freeDeliveryRemaining({ subtotal: 499.99, free_delivery_above: 500 }), 0.01);
});

test("no progress once the threshold is met, when there is no threshold, or for unusable numbers", () => {
  assert.equal(freeDeliveryRemaining({ subtotal: 500, free_delivery_above: 500 }), null);
  assert.equal(freeDeliveryRemaining({ subtotal: 900, free_delivery_above: 500 }), null);
  assert.equal(freeDeliveryRemaining({ subtotal: 100, free_delivery_above: null }), null);
  assert.equal(freeDeliveryRemaining({ subtotal: 100 }), null);
  assert.equal(freeDeliveryRemaining({ subtotal: 100, free_delivery_above: 0 }), null);
  assert.equal(freeDeliveryRemaining({ subtotal: "100", free_delivery_above: 500 }), null);
  assert.equal(freeDeliveryRemaining(null), null);
});

test("floating-point drift never leaks into the rupees shown", () => {
  assert.equal(freeDeliveryRemaining({ subtotal: 0.1 + 0.2, free_delivery_above: 1 }), 0.7);
});

// ---- the View cart bar ----------------------------------------------------------------------------------------

test("an empty cart hides the bar", () => {
  const readiness = cartReadiness({ cart: emptyCart(), identity, record: null });
  assert.deepEqual(cartBarSummary({ cart: emptyCart(), readiness }), { visible: false, units: 0, total: null });
  assert.equal(cartBarSummary({ cart: null, readiness }).visible, false);
});

test("a current quote supplies the packet count and the total", () => {
  const cart = cartOf([12, 3], [40, 2]);
  const quote = quoteFor(cart, { total: 321.5 });
  const readiness = cartReadiness({ cart, identity, record: recordFor(cart, quote) });
  assert.deepEqual(cartBarSummary({ cart, readiness }), { visible: true, units: 5, total: 321.5 });
});

test("while the quote is not current the bar counts the cart's packets and shows no total", () => {
  const cart = cartOf([12, 3], [40, 2]);
  const old = recordFor(cart, quoteFor(cart, { total: 321.5 }));
  const changed = updateCartQuantity(cart, 12, 6);
  const readiness = cartReadiness({ cart: changed, identity, record: old });
  assert.deepEqual(cartBarSummary({ cart: changed, readiness }), { visible: true, units: 8, total: null });
});

test("a failed quote still shows the cart, with no total", () => {
  const cart = cartOf([12, 3]);
  const readiness = cartReadiness({ cart, identity, record: recordFor(cart, null, { phase: "error" }) });
  assert.deepEqual(cartBarSummary({ cart, readiness }), { visible: true, units: 3, total: null });
});

test("a stock review still shows the quote's own count and total", () => {
  const cart = cartOf([12, 3]);
  const readiness = cartReadiness({ cart, identity, record: recordFor(cart, shortQuote(cart, { 12: 1 })) });
  assert.equal(readiness.state, "stock");
  assert.equal(cartBarSummary({ cart, readiness }).units, 3);
});

// ---- quote failures are reviewable messages, never an empty cart ---------------------------------------------------

test("a 422 that names products is the unavailable case, with those ids", () => {
  const error = { status: 422, payload: { detail: { message: "Some products are not available", sku_ids: [3, 9, "x", -1] } } };
  const described = describeQuoteError(error);
  assert.equal(described.kind, "unavailable");
  assert.deepEqual(described.skuIds, [3, 9]);
  assert.match(described.message, /no longer available/);
});

test("a 503 is a closed store and says the cart is saved", () => {
  const described = describeQuoteError({ status: 503, payload: { detail: "Store is not taking orders right now" } });
  assert.equal(described.kind, "closed");
  assert.match(described.message, /cart is saved/);
});

test("anything else, a lost connection included, is the approved failure copy", () => {
  for (const error of [{ status: 500 }, { status: 422, payload: { detail: [{ msg: "x" }] } }, { reason: "network" }, null, undefined]) {
    const described = describeQuoteError(error);
    assert.equal(described.kind, "failed");
    assert.equal(described.message, "We couldn't update your total. Try again before placing your order.");
    assert.deepEqual(described.skuIds, []);
  }
});
