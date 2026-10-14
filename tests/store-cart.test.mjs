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
  describeReorder,
  emptyCart,
  freeDeliveryRemaining,
  performReorder,
  quoteMatchesCart,
  quoteRequestBody,
  readStoredCart,
  reconcileReorder,
  reorderSkipText,
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
  assert.equal(cartStorageKey(6), "ascend_store_cart:v2:6");
  assert.equal(cartStorageKey("7"), "ascend_store_cart:v2:7");
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
  assert.deepEqual(Object.keys(storage.dump()), ["ascend_store_cart:v2:6"]);
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

// ---- reorder: a past order's intent merged into the cart at today's availability (09-10) --------------------------------

const product = (id, extra = {}) => ({ id, name: `Snack ${id}`, in_stock: true, mrp: 120, trade_price: 100, max_orderable: 10, ...extra });
// What an order detail carries. The money on it is history and must never reach the cart.
const pastLine = (skuId, quantity, extra = {}) => ({ sku_id: skuId, quantity, name: `Snack ${skuId}`, line_total: 999, ...extra });

test("an existing 2 and a past 3 of the same product become 5 packets", () => {
  const result = reconcileReorder(cartOf([7, 2]), [pastLine(7, 3)], [product(7)]);
  assert.deepEqual(result.lines, [{ sku_id: 7, quantity: 5 }]);
  assert.equal(cartQuantity(result.cart, 7), 5);
  assert.equal(result.changed, true);
  assert.deepEqual(result.skipped, []);
  assert.deepEqual(result.reduced, []);
  assert.deepEqual(result.added, [{ sku_id: 7, name: "Snack 7", quantity: 3 }]);
});

test("the merge is not held back by stock: a shortage is trimmed at checkout", () => {
  const result = reconcileReorder(cartOf([7, 2]), [pastLine(7, 3)], [product(7, { max_orderable: 4 })]);
  assert.equal(cartQuantity(result.cart, 7), 5);
  assert.deepEqual(result.reduced, []);
  assert.deepEqual(result.added, [{ sku_id: 7, name: "Snack 7", quantity: 3 }]);
});

test("a cart line the past order does not mention survives untouched", () => {
  const result = reconcileReorder(cartOf([3, 4], [7, 2]), [pastLine(7, 3)], [product(7)]);
  assert.equal(cartQuantity(result.cart, 3), 4);
  assert.equal(cartQuantity(result.cart, 7), 5);
  assert.deepEqual(
    result.lines.map((line) => line.sku_id),
    [3, 7]
  );
});

test("a past product that is not in the cart is added after the lines already there", () => {
  const result = reconcileReorder(cartOf([3, 4]), [pastLine(7, 3)], [product(7)]);
  assert.deepEqual(result.lines, [
    { sku_id: 3, quantity: 4 },
    { sku_id: 7, quantity: 3 }
  ]);
});

test("a historic line_total, name or price never becomes part of the cart", () => {
  const result = reconcileReorder(emptyCart(), [pastLine(7, 3, { mrp: 1, trade_price: 1, unit_price: 1 })], [product(7)]);
  assert.deepEqual(Object.keys(result.lines[0]).sort(), ["quantity", "sku_id"]);
  assert.equal(JSON.stringify(result.cart.lines).includes("999"), false);
  assert.deepEqual(quoteRequestBody(result.cart), { items: [{ sku_id: 7, quantity: 3 }] });
});

test("a reorder that changes the cart is a new revision, so it is quoted again", () => {
  const before = cartOf([7, 2]);
  const result = reconcileReorder(before, [pastLine(7, 3)], [product(7)]);
  assert.equal(result.cart.revision, before.revision + 1);
});

// One reorder, run against stand-ins for the two reads it is allowed to make. The recording transport
// is how these tests prove that nothing but a GET of an order and of products is ever asked.
function reorderHarness({ order = { lines: [pastLine(7, 3)] }, products = { 7: product(7) }, cart = cartOf([7, 2]), generation = { value: 1 } } = {}) {
  const asked = [];
  const owner = { generation: 1, retailerId: 5 };
  const current = { cart };
  const options = {
    owner,
    orderId: 40,
    getGeneration: () => generation.value,
    getOrder: async (id) => {
      asked.push(`GET order ${id}`);
      return order;
    },
    getProduct: async (id) => {
      asked.push(`GET product ${id}`);
      if (!products[id]) throw Object.assign(new Error("not found"), { status: 404 });
      return products[id];
    },
    apply: (lines, found) => {
      const result = reconcileReorder(current.cart, lines, found);
      current.cart = result.cart;
      return result;
    }
  };
  return { options, asked, current, generation };
}

test("a history reorder reads the order, then the current products, and sends nothing else", async () => {
  const harness = reorderHarness();
  const outcome = await performReorder(harness.options);
  assert.equal(outcome.status, "done");
  assert.deepEqual(harness.asked, ["GET order 40", "GET product 7"]);
  assert.equal(cartQuantity(harness.current.cart, 7), 5);
});

test("a detail reorder uses the lines it already has and does not read the order again", async () => {
  const harness = reorderHarness();
  const outcome = await performReorder({ ...harness.options, lines: [pastLine(7, 3)] });
  assert.equal(outcome.status, "done");
  assert.deepEqual(harness.asked, ["GET product 7"]);
});

// ---- reorder: what changed in the catalogue since the order was placed (09-10 task 2) --------------------------------------

const names = (list) => list.map((item) => item.name);

test("a product that is unlisted, sold out or unpriced is skipped by name, and the rest is added", () => {
  const cart = cartOf([3, 1]);
  const result = reconcileReorder(
    cart,
    [pastLine(7, 2), pastLine(8, 1), pastLine(9, 1), pastLine(10, 4), pastLine(11, 1, { name: "Retired Crisps" })],
    [product(7), product(8, { in_stock: false, max_orderable: 0 }), product(9, { trade_price: undefined }), product(10, { max_orderable: 3 })]
  );
  assert.deepEqual(result.lines, [
    { sku_id: 3, quantity: 1 },
    { sku_id: 7, quantity: 2 },
    { sku_id: 10, quantity: 4 }
  ]);
  assert.deepEqual(
    result.skipped.map(({ sku_id, reason }) => [sku_id, reason]),
    [[8, "out-of-stock"], [9, "unavailable"], [11, "unlisted"]]
  );
  assert.equal(result.skipped.find((item) => item.sku_id === 11).name, "Retired Crisps");
  assert.deepEqual(names(result.reduced), []);
  assert.equal(result.outcome, "partial");
  assert.equal(describeReorder(result, 40).message, "Some items changed. Review your cart before ordering.");
});

test("when nothing can be added the very same cart comes back, with the approved copy", () => {
  const cart = cartOf([3, 4], [7, 2]);
  const result = reconcileReorder(cart, [pastLine(8, 1), pastLine(11, 2)], [product(8, { in_stock: false, max_orderable: 0 })]);
  assert.equal(result.cart, cart);
  assert.equal(result.changed, false);
  assert.equal(result.outcome, "none");
  assert.deepEqual(result.lines, [
    { sku_id: 3, quantity: 4 },
    { sku_id: 7, quantity: 2 }
  ]);
  const told = describeReorder(result, 40);
  assert.equal(told.kind, "none");
  assert.equal(told.message, "These items are currently unavailable. Your cart hasn't changed.");
  assert.equal(told.skipped.length, 2);
});

test("a line stops at 999 packets even when the product's cap is higher", () => {
  const result = reconcileReorder(cartOf([7, 990]), [pastLine(7, 20)], [product(7, { max_orderable: 5000 })]);
  assert.equal(cartQuantity(result.cart, 7), MAX_LINE_QUANTITY);
  assert.deepEqual(result.reduced, [{ sku_id: 7, name: "Snack 7", wanted: 1010, quantity: 999 }]);
  const fresh = reconcileReorder(emptyCart(), [pastLine(8, 5000)], [product(8, { max_orderable: 5000 })]);
  assert.equal(cartQuantity(fresh.cart, 8), MAX_LINE_QUANTITY);
});

test("a cart already at 50 products takes more of a product it has, and skips a new one by name", () => {
  const full = Array.from({ length: MAX_CART_LINES }, (_, index) => [100 + index, 1]).reduce((cart, [id, quantity]) => updateCartQuantity(cart, id, quantity), emptyCart());
  assert.equal(full.lines.length, MAX_CART_LINES);
  const result = reconcileReorder(full, [pastLine(100, 2), pastLine(7, 1)], [product(100), product(7)]);
  assert.equal(cartQuantity(result.cart, 100), 3);
  assert.equal(result.cart.lines.length, MAX_CART_LINES);
  assert.deepEqual(
    result.skipped.map(({ sku_id, reason }) => [sku_id, reason]),
    [[7, "cart-full"]]
  );
  assert.equal(result.outcome, "partial");
});

test("the 50-product limit is met exactly: the 50th is added and the 51st is skipped", () => {
  const nearly = Array.from({ length: MAX_CART_LINES - 1 }, (_, index) => [100 + index, 1]).reduce((cart, [id, quantity]) => updateCartQuantity(cart, id, quantity), emptyCart());
  const result = reconcileReorder(nearly, [pastLine(7, 1), pastLine(8, 1)], [product(7), product(8)]);
  assert.equal(result.cart.lines.length, MAX_CART_LINES);
  assert.deepEqual(names(result.added), ["Snack 7"]);
  assert.deepEqual(names(result.skipped), ["Snack 8"]);
});

test("one product listed twice in the order is one line with both quantities", () => {
  const result = reconcileReorder(emptyCart(), [pastLine(7, 2), pastLine(7, 3)], [product(7)]);
  assert.deepEqual(result.lines, [{ sku_id: 7, quantity: 5 }]);
});

test("junk past lines and junk products are ignored, never added", () => {
  const junk = [null, {}, { sku_id: 0, quantity: 1 }, { sku_id: 7, quantity: 0 }, { sku_id: 7, quantity: 1.5 }, { sku_id: "7", quantity: 1 }, pastLine(8, 1)];
  const result = reconcileReorder(emptyCart(), junk, [null, { id: "8" }, product(8)]);
  assert.deepEqual(result.lines, [{ sku_id: 8, quantity: 1 }]);
  assert.deepEqual(reconcileReorder(emptyCart(), "no", "no").lines, []);
});

test("a full reorder is told as such and names nothing as skipped", () => {
  const told = describeReorder(reconcileReorder(emptyCart(), [pastLine(7, 2)], [product(7)]), 40);
  assert.equal(told.kind, "review");
  assert.equal(told.message, "Items from Order #40 are in your cart. Review your cart before ordering.");
  assert.deepEqual(told.skipped, []);
  assert.deepEqual(told.reduced, []);
});

test("each skip reason has words that follow the product's name", () => {
  assert.equal(reorderSkipText("unlisted"), "no longer listed");
  assert.equal(reorderSkipText("out-of-stock"), "out of stock");
  assert.match(reorderSkipText("cart-full"), /cart is full \(50 products\)/);
  assert.equal(reorderSkipText("unavailable"), "not available to order right now");
});

// ---- performReorder: failures and races ---------------------------------------------------------------------------------------

test("a product the store no longer lists (404) is skipped, and the others are still added", async () => {
  const harness = reorderHarness({ order: { lines: [pastLine(7, 3), pastLine(8, 1)] }, products: { 7: product(7) } });
  const outcome = await performReorder(harness.options);
  assert.equal(outcome.status, "done");
  assert.equal(outcome.view.kind, "review");
  assert.deepEqual(
    outcome.result.skipped.map((item) => item.sku_id),
    [8]
  );
  assert.equal(cartQuantity(harness.current.cart, 7), 5);
});

test("a lookup that fails for any other reason stops the reorder with nothing changed", async () => {
  for (const status of [500, 503, 0, 401]) {
    const harness = reorderHarness({ order: { lines: [pastLine(7, 3), pastLine(8, 1)] }, products: { 7: product(7), 8: product(8) } });
    const original = harness.options.getProduct;
    harness.options.getProduct = async (id) => {
      if (id === 8) throw Object.assign(new Error("boom"), { status });
      return original(id);
    };
    const before = harness.current.cart;
    const outcome = await performReorder(harness.options);
    assert.equal(outcome.status, "failed", `status ${status}`);
    assert.equal(outcome.view.retry, true);
    assert.equal(outcome.view.message, "We couldn't check what's available right now. Your cart hasn't changed. Try again.");
    assert.equal(harness.current.cart, before);
  }
});

test("an order that is gone, empty or unreadable is told, and the cart is untouched", async () => {
  const gone = reorderHarness();
  gone.options.getOrder = async () => {
    throw Object.assign(new Error("not found"), { status: 404 });
  };
  const goneOutcome = await performReorder(gone.options);
  assert.equal(goneOutcome.status, "failed");
  assert.equal(goneOutcome.view.message, "This order isn't available.");
  assert.equal(goneOutcome.view.retry, false);

  const empty = reorderHarness({ order: { lines: [] } });
  const emptyOutcome = await performReorder(empty.options);
  assert.equal(emptyOutcome.status, "failed");
  assert.equal(emptyOutcome.view.message, "This order has no items to add. Your cart hasn't changed.");

  const odd = reorderHarness({ order: null });
  assert.equal((await performReorder(odd.options)).status, "failed");
});

test("nothing is looked up for a product twice, and only four are in flight at once", async () => {
  const lines = Array.from({ length: 12 }, (_, index) => pastLine(index + 1, 1));
  const products = Object.fromEntries(lines.map((line) => [line.sku_id, product(line.sku_id)]));
  const harness = reorderHarness({ order: { lines: [...lines, pastLine(1, 1)] }, products, cart: emptyCart() });
  let inFlight = 0;
  let peak = 0;
  const original = harness.options.getProduct;
  harness.options.getProduct = async (id) => {
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 2));
    inFlight -= 1;
    return original(id);
  };
  const outcome = await performReorder(harness.options);
  assert.equal(outcome.status, "done");
  assert.equal(harness.asked.filter((entry) => entry.startsWith("GET product")).length, 12);
  assert.equal(peak, 4);
  assert.equal(cartQuantity(harness.current.cart, 1), 2);
});

test("an account switch while the order is being read drops the whole result", async () => {
  const harness = reorderHarness();
  const original = harness.options.getOrder;
  harness.options.getOrder = async (id) => {
    const order = await original(id);
    harness.generation.value = 2;
    return order;
  };
  let applied = false;
  const apply = harness.options.apply;
  harness.options.apply = (...args) => {
    applied = true;
    return apply(...args);
  };
  const before = harness.current.cart;
  assert.deepEqual(await performReorder(harness.options), { status: "stale" });
  assert.equal(applied, false);
  assert.equal(harness.current.cart, before);
  assert.deepEqual(harness.asked, ["GET order 40"]);
});

test("an account switch while products are being read drops the result and changes no cart", async () => {
  const harness = reorderHarness();
  const original = harness.options.getProduct;
  harness.options.getProduct = async (id) => {
    const found = await original(id);
    harness.generation.value = 2;
    return found;
  };
  let applied = false;
  const apply = harness.options.apply;
  harness.options.apply = (...args) => {
    applied = true;
    return apply(...args);
  };
  const before = harness.current.cart;
  assert.deepEqual(await performReorder(harness.options), { status: "stale" });
  assert.equal(applied, false);
  assert.equal(harness.current.cart, before);
});

test("a session that ends during a lookup is a stale reorder, not a failed one", async () => {
  for (const reason of ["stale", "session-expired", "needs-login"]) {
    const harness = reorderHarness();
    harness.options.getProduct = async () => {
      throw Object.assign(new Error("ended"), { reason });
    };
    assert.deepEqual(await performReorder(harness.options), { status: "stale" }, reason);
    const orderHarness = reorderHarness();
    orderHarness.options.getOrder = async () => {
      throw Object.assign(new Error("ended"), { reason });
    };
    assert.deepEqual(await performReorder(orderHarness.options), { status: "stale" }, reason);
  }
});

test("if apply says the owner is gone, the reorder is stale and nothing is claimed", async () => {
  const harness = reorderHarness();
  harness.options.apply = () => null;
  assert.deepEqual(await performReorder(harness.options), { status: "stale" });
});

test("a cart edited while the products were being read is merged into, never replaced", async () => {
  const harness = reorderHarness({ cart: cartOf([7, 2]) });
  const original = harness.options.getProduct;
  harness.options.getProduct = async (id) => {
    const found = await original(id);
    // The retailer changed their cart in the meantime: sku 7 is now 6, and a new product was added.
    harness.current.cart = updateCartQuantity(updateCartQuantity(harness.current.cart, 7, 6), 3, 4);
    return found;
  };
  const outcome = await performReorder(harness.options);
  assert.equal(outcome.status, "done");
  assert.equal(cartQuantity(harness.current.cart, 7), 9);
  assert.equal(cartQuantity(harness.current.cart, 3), 4);
});

test("a product that answers with another product's id is not trusted", async () => {
  const harness = reorderHarness({ products: { 7: product(99) } });
  const outcome = await performReorder(harness.options);
  assert.equal(outcome.status, "failed");
});

test("reorder rounds a past loose-piece quantity up to whole ladis", () => {
  const ladi = { units_per_pack: 12, pack_type: "ladi" };
  const up = reconcileReorder(emptyCart(), [pastLine(7, 5), pastLine(8, 30)], [product(7, ladi), product(8, ladi)]);
  assert.deepEqual(up.lines, [
    { sku_id: 7, quantity: 12 },
    { sku_id: 8, quantity: 36 }
  ]);
  assert.equal(up.outcome, "full");
});

test("a guest cart has its own key and is summed into the retailer's cart at login", async () => {
  const { GUEST_CART, mergeGuestCart } = await import("../lib/store/cart.mjs");
  assert.equal(cartStorageKey(GUEST_CART), "ascend_store_cart:v2:guest");
  const merged = mergeGuestCart(cartOf([7, 12], [3, 1]), cartOf([7, 24], [9, 10]));
  assert.deepEqual(merged.lines, [
    { sku_id: 7, quantity: 36 },
    { sku_id: 3, quantity: 1 },
    { sku_id: 9, quantity: 10 }
  ]);
  const own = cartOf([7, 12]);
  assert.equal(mergeGuestCart(own, emptyCart()), own);
});
