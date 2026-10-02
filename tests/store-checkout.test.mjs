// Behaviour tests for placing one pay-on-delivery order. node:test, no framework, no network:
//
//   node --test tests/store-checkout.test.mjs
//
// Every test drives the real createCheckoutController (and the real transport for the wire shape).
// The backend is mocked on purpose: the local database is a restored production copy and an order
// must never be placed against it. What these tests pin down is what the app SENDS and what it
// CLAIMS: one send per submission, only items and address_id on the wire, success only for a 201
// with an order id, and a cart that is cleared only when it is still the one that was ordered.
import assert from "node:assert/strict";
import { test } from "node:test";
import * as api from "../lib/store/api.mjs";
import * as cartModule from "../lib/store/cart.mjs";
import { normalizeOrderList } from "../lib/store/orders.mjs";
import { createRetailerSession } from "../lib/store/session.mjs";

const { storeEndpoints } = api;
const { emptyCart, updateCartQuantity, writeStoredCart, readStoredCart } = cartModule;

// ---- fixtures --------------------------------------------------------------------------------------

const ORDER = Object.freeze({
  id: 4821,
  status: "PENDING",
  created_at: "2026-10-02T10:00:00Z",
  lines: [{ sku_id: 5, name: "Salted chips", quantity: 2, mrp: 20, line_total: 32 }],
  subtotal: 32,
  delivery_charge: 40,
  total: 72,
  ship_to: { label: "Shop", line1: "12 MG Road", city: "Bengaluru", state: "Karnataka", pincode: 560001 },
  invoice_available: false
});

const OWNER = Object.freeze({ generation: 1, retailerId: 71, revision: 3 });
const ITEMS = Object.freeze([Object.freeze({ sku_id: 5, quantity: 2 })]);

const memoryStorage = (initial = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    dump: () => Object.fromEntries(data)
  };
};

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// A controller wired to recording fakes. post(path, init) decides the answer; every send is kept.
function harness({ post, get, storage = memoryStorage(), generation = 1 } = {}) {
  const state = { generation };
  const sent = [];
  const confirmed = [];
  const controller = api.createCheckoutController({
    post: (path, init) => {
      sent.push({ path, method: init.method, body: JSON.parse(init.body) });
      return post ? post(path, init) : Promise.resolve({ status: 201, body: ORDER });
    },
    get: (path, init) => (get ? get(path, init) : Promise.reject(new Error("this test never reads orders"))),
    parseOrderList: normalizeOrderList,
    getStorage: () => storage,
    getGeneration: () => state.generation,
    onConfirmed: (info) => confirmed.push(info)
  });
  return { controller, sent, confirmed, storage, state };
}

const request = (extra = {}) => ({ owner: OWNER, items: ITEMS, addressId: 11, ...extra });

// ---- the request is items and address_id and nothing else (T-09-08-1) ------------------------------

test("the order body carries sku ids, whole packets and the address id only", () => {
  const body = api.orderRequestBody(
    [{ sku_id: 5, quantity: 2, name: "Chips", trade_price: 16, line_total: 32, warehouse_id: 9, retailer_id: 1, salesman_id: 4 }],
    11
  );
  assert.deepEqual(body, { items: [{ sku_id: 5, quantity: 2 }], address_id: 11 });
  assert.deepEqual(Object.keys(body).sort(), ["address_id", "items"]);
});

test("a body that cannot be an order is refused before anything is sent", () => {
  const ok = [{ sku_id: 5, quantity: 2 }];
  assert.equal(api.orderRequestBody([], 11), null, "no lines");
  assert.equal(api.orderRequestBody(null, 11), null);
  assert.equal(api.orderRequestBody(ok, null), null, "no address");
  assert.equal(api.orderRequestBody(ok, 0), null);
  assert.equal(api.orderRequestBody(ok, "abc"), null);
  assert.equal(api.orderRequestBody(ok, 1.5), null);
  assert.equal(api.orderRequestBody([{ sku_id: 5, quantity: 1.5 }], 11), null, "fractional packets");
  assert.equal(api.orderRequestBody([{ sku_id: 5, quantity: 0 }], 11), null);
  assert.equal(api.orderRequestBody([{ sku_id: 5, quantity: 1000 }], 11), null, "over the 999 cap");
  assert.equal(api.orderRequestBody([{ sku_id: 0, quantity: 1 }], 11), null);
  assert.equal(api.orderRequestBody([{ sku_id: 5, quantity: 1 }, { sku_id: 5, quantity: 2 }], 11), null, "a repeated product");
  const fifty = Array.from({ length: 50 }, (_, i) => ({ sku_id: i + 1, quantity: 1 }));
  assert.ok(api.orderRequestBody(fifty, 11));
  assert.equal(api.orderRequestBody([...fifty, { sku_id: 51, quantity: 1 }], 11), null, "51 lines");
});

test("the address id from the server's list is sent as a number", () => {
  assert.equal(api.orderRequestBody([{ sku_id: 5, quantity: 1 }], "11").address_id, 11);
});

// ---- what enables Place order ------------------------------------------------------------------------

const ready = { ready: true };
const listed = [{ id: 11 }, { id: 12 }];
const gateInput = (extra = {}) => ({
  canPurchase: true,
  lineCount: 1,
  readiness: ready,
  address: { id: 11 },
  addresses: listed,
  view: { phase: "idle" },
  ...extra
});

test("only a ready session, a current in-stock quote and a listed address enable Place order", () => {
  assert.deepEqual(api.checkoutGate(gateInput()), { canPlace: true, reason: null });
  assert.equal(api.checkoutGate(gateInput({ canPurchase: false })).canPlace, false);
  assert.equal(api.checkoutGate(gateInput({ lineCount: 0 })).reason, "empty");
  assert.equal(api.checkoutGate(gateInput({ readiness: { ready: false } })).reason, "quote");
  assert.equal(api.checkoutGate(gateInput({ readiness: null })).reason, "quote");
});

test("no address, or one the server does not list, never enables Place order", () => {
  assert.equal(api.checkoutGate(gateInput({ addresses: [], address: null })).reason, "no-address");
  assert.equal(api.checkoutGate(gateInput({ address: null })).reason, "choose-address");
  assert.equal(api.checkoutGate(gateInput({ address: { id: 99 } })).reason, "choose-address");
  assert.equal(api.checkoutGate(gateInput({ address: { id: "11" } })).canPlace, true, "ids compare as the same number");
});

test("a submission already under way disables Place order", () => {
  const gate = api.checkoutGate(gateInput({ view: { phase: "submitting" } }));
  assert.equal(gate.canPlace, false);
  assert.equal(gate.reason, "submitting");
});

// ---- one reviewed cart becomes one order -------------------------------------------------------------

test("one submit sends one POST /store/orders with items and address_id only", async () => {
  const { controller, sent } = harness();
  const result = await controller.submit(request({ items: [{ sku_id: 5, quantity: 2, name: "Chips", line_total: 32 }] }));
  assert.equal(sent.length, 1);
  assert.equal(sent[0].path, storeEndpoints.orders);
  assert.equal(sent[0].method, "POST");
  assert.deepEqual(sent[0].body, { items: [{ sku_id: 5, quantity: 2 }], address_id: 11 });
  assert.equal(result.sent, true);
  assert.equal(result.outcome, "confirmed");
});

test("a 201 with an order id is the only confirmation, and it keeps the server's own order", async () => {
  const { controller, confirmed } = harness();
  await controller.submit(request());
  const state = controller.getState();
  assert.equal(state.phase, "confirmed");
  assert.equal(state.order.id, 4821);
  assert.equal(state.order.total, 72, "the amount is the server's, not computed here");
  assert.equal(state.order.ship_to.line1, "12 MG Road");
  assert.equal(confirmed.length, 1);
  assert.equal(confirmed[0].order.id, 4821);
  assert.deepEqual(confirmed[0].owner, OWNER);
  assert.deepEqual(confirmed[0].items, [{ sku_id: 5, quantity: 2 }]);
});

test("a 2xx that is not a 201, or a 201 with no usable order id, is not a confirmation", async () => {
  for (const answer of [
    { status: 200, body: ORDER },
    { status: 202, body: ORDER },
    { status: 201, body: null },
    { status: 201, body: {} },
    { status: 201, body: { ...ORDER, id: 0 } },
    { status: 201, body: { ...ORDER, id: "4821" } },
    { status: 201, body: "ok" }
  ]) {
    const { controller, confirmed } = harness({ post: async () => answer });
    const result = await controller.submit(request());
    assert.notEqual(result.outcome, "confirmed", JSON.stringify(answer));
    assert.notEqual(controller.getState().phase, "confirmed");
    assert.equal(confirmed.length, 0, "the cart is never cleared on an unconfirmed answer");
  }
});

// ---- the synchronous in-flight guard (T-09-08-2) ------------------------------------------------------

test("two clicks in the same tick send once", async () => {
  const gate = deferred();
  const { controller, sent } = harness({ post: () => gate.promise });
  const first = controller.submit(request());
  const second = controller.submit(request());
  const third = controller.submit(request());
  assert.equal(controller.getState().phase, "submitting", "locked before any await");
  gate.resolve({ status: 201, body: ORDER });
  const results = await Promise.all([first, second, third]);
  assert.equal(sent.length, 1);
  assert.equal(results[0].outcome, "confirmed");
  assert.deepEqual([results[1].sent, results[1].reason], [false, "in-flight"]);
  assert.deepEqual([results[2].sent, results[2].reason], [false, "in-flight"]);
});

test("a click while the answer is pending sends nothing more", async () => {
  const gate = deferred();
  const { controller, sent } = harness({ post: () => gate.promise });
  const first = controller.submit(request());
  await new Promise((resolve) => setTimeout(resolve, 5));
  const again = await controller.submit(request());
  assert.equal(again.reason, "in-flight");
  assert.equal(sent.length, 1);
  gate.resolve({ status: 201, body: ORDER });
  await first;
  assert.equal(sent.length, 1);
});

test("a failed submission releases the lock but never sends a second order by itself", async () => {
  const { controller, sent } = harness({ post: async () => Promise.reject(new api.StoreApiError("Network error", { reason: "network" })) });
  await controller.submit(request());
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(sent.length, 1, "no automatic resend");
});

// ---- nothing is sent unless the request is whole -------------------------------------------------------

test("a submit with no usable address or lines sends nothing", async () => {
  const { controller, sent } = harness();
  assert.equal((await controller.submit(request({ addressId: null }))).reason, "incomplete");
  assert.equal((await controller.submit(request({ items: [] }))).reason, "incomplete");
  assert.equal((await controller.submit(request({ owner: null }))).reason, "incomplete");
  assert.equal((await controller.submit({})).reason, "incomplete");
  assert.equal((await controller.submit(undefined)).reason, "incomplete");
  assert.equal(sent.length, 0);
  assert.equal(controller.getState().phase, "idle");
});

test("a submit for an account that is no longer the signed-in one sends nothing", async () => {
  const { controller, sent, state } = harness();
  state.generation = 2;
  const result = await controller.submit(request());
  assert.deepEqual([result.sent, result.reason], [false, "stale"]);
  assert.equal(sent.length, 0);
});

// ---- the address is checked fresh, after the lock, before the send ------------------------------------

test("an address the server no longer lists is not sent to", async () => {
  const { controller, sent } = harness();
  const result = await controller.submit(request({ confirmAddress: async () => false }));
  assert.equal(sent.length, 0);
  assert.equal(result.sent, false);
  assert.equal(controller.getState().phase, "refused");
  assert.equal(controller.getState().problem.kind, "address");
});

test("the fresh address check holds the lock, so a second click during it sends nothing", async () => {
  const gate = deferred();
  const { controller, sent } = harness();
  const first = controller.submit(request({ confirmAddress: () => gate.promise }));
  const second = await controller.submit(request());
  assert.equal(second.reason, "in-flight");
  gate.resolve(true);
  await first;
  assert.equal(sent.length, 1);
});

test("a check that cannot run sends nothing and says the order was not sent", async () => {
  const { controller, sent } = harness();
  const result = await controller.submit(request({ confirmAddress: async () => Promise.reject(new api.StoreApiError("Network error", { reason: "network" })) }));
  assert.equal(sent.length, 0);
  assert.equal(result.sent, false);
  assert.equal(controller.getState().problem.kind, "not-sent");
});

test("a cart that changed while the address was checked is not sent", async () => {
  const { controller, sent } = harness();
  const result = await controller.submit(request({ confirmAddress: async () => true, isCurrent: () => false }));
  assert.equal(sent.length, 0);
  assert.equal(result.sent, false);
  assert.equal(controller.getState().problem.kind, "changed");
});

// ---- an answer for another account is never shown to this one (T-09-08-3) --------------------------------

test("a confirmation that arrives after the account changed shows nothing to the new account but still settles the old cart", async () => {
  const gate = deferred();
  const { controller, confirmed, state } = harness({ post: () => gate.promise });
  const pending = controller.submit(request());
  state.generation = 2; // signed out, another retailer signed in
  controller.sync({ generation: 2, retailerId: 88 });
  assert.equal(controller.getState().phase, "idle", "the new account starts clean");
  gate.resolve({ status: 201, body: ORDER });
  await pending;
  assert.equal(controller.getState().phase, "idle", "the old order is not shown to the new account");
  assert.equal(confirmed.length, 1, "the old retailer's cart is still settled so it cannot be ordered twice");
  assert.deepEqual(confirmed[0].owner, OWNER);
});

test("syncing to another account clears any state that belonged to the previous one", async () => {
  const { controller } = harness();
  await controller.submit(request());
  assert.equal(controller.getState().phase, "confirmed");
  controller.sync({ generation: 2, retailerId: 88 });
  assert.equal(controller.getState().phase, "idle");
  controller.sync(null);
  assert.equal(controller.getState().phase, "idle");
});

test("a result is shown only for the identity it was asked under", () => {
  const confirmed = { phase: "confirmed", owner: OWNER, order: { id: 1 } };
  assert.equal(api.checkoutView(confirmed, { generation: 1, retailerId: 71 }, 3).phase, "confirmed");
  assert.equal(api.checkoutView(confirmed, { generation: 2, retailerId: 71 }, 3).phase, "idle", "another session");
  assert.equal(api.checkoutView(confirmed, { generation: 1, retailerId: 72 }, 3).phase, "idle", "another retailer");
  assert.equal(api.checkoutView(confirmed, null, null).phase, "idle", "signed out");
});

// ---- the cart is cleared only when it is still what was ordered ------------------------------------------

test("clearing a cart empties it and moves to a new revision so no earlier quote can match", () => {
  const cart = updateCartQuantity(updateCartQuantity(emptyCart(), 5, 2), 6, 1);
  const cleared = cartModule.clearCart(cart);
  assert.equal(cleared.lines.length, 0);
  assert.ok(cleared.revision > cart.revision);
  const empty = emptyCart(4);
  assert.equal(cartModule.clearCart(empty), empty, "nothing to clear, nothing changes");
});

test("sameCartLines compares the contents, not their order", () => {
  const cart = updateCartQuantity(updateCartQuantity(emptyCart(), 5, 2), 6, 1);
  assert.equal(cartModule.sameCartLines(cart, [{ sku_id: 6, quantity: 1 }, { sku_id: 5, quantity: 2 }]), true);
  assert.equal(cartModule.sameCartLines(cart, [{ sku_id: 5, quantity: 2 }]), false, "a line fewer");
  assert.equal(cartModule.sameCartLines(cart, [{ sku_id: 5, quantity: 3 }, { sku_id: 6, quantity: 1 }]), false, "another quantity");
  assert.equal(cartModule.sameCartLines(emptyCart(), []), true);
  assert.equal(cartModule.sameCartLines(cart, null), false);
});

test("a stored cart is cleared for the ordering retailer only, and only if it is unchanged", () => {
  const storage = memoryStorage();
  writeStoredCart(storage, 71, updateCartQuantity(emptyCart(), 5, 2));
  writeStoredCart(storage, 72, updateCartQuantity(emptyCart(), 5, 2));
  assert.equal(cartModule.storedCartMatches(storage, 71, [{ sku_id: 5, quantity: 2 }]), true);
  assert.equal(cartModule.storedCartMatches(storage, 71, [{ sku_id: 5, quantity: 3 }]), false, "changed since the order was sent");
  assert.equal(cartModule.storedCartMatches(storage, 99, [{ sku_id: 5, quantity: 2 }]), false, "no cart for that retailer");
  writeStoredCart(storage, 71, emptyCart());
  assert.equal(readStoredCart(storage, 71).lines.length, 0);
  assert.equal(readStoredCart(storage, 72).lines.length, 1, "another retailer's cart is untouched");
});

// ---- the wire: what the real transport sends and reports -------------------------------------------------

const b64url = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const accessToken = () =>
  `${b64url({ alg: "none" })}.${b64url({ user_id: 71, role: "RETAILER", tv: 0, exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;

function wire(route) {
  const storage = memoryStorage();
  const session = createRetailerSession({ getStorage: () => storage, eventTarget: null });
  session.save({ accessToken: accessToken(), refreshToken: "refresh-1" });
  const calls = [];
  const transport = api.createStoreTransport({
    session,
    baseUrl: "http://api.test",
    fetch: async (url, init = {}) => {
      const call = { path: new URL(url).pathname, method: (init.method || "GET").toUpperCase(), body: init.body, auth: new Headers(init.headers).get("authorization") };
      calls.push(call);
      return route(call);
    }
  });
  return { transport, calls };
}

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("storeFetchResponse reports the status the server gave, so only a 201 can be believed", async () => {
  const { transport } = wire(() => json(201, ORDER));
  const answer = await transport.storeFetchResponse(storeEndpoints.orders, { method: "POST", body: "{}" });
  assert.equal(answer.status, 201);
  assert.equal(answer.body.id, 4821);
});

test("an order through the real transport sends the bearer and exactly the request body, once", async () => {
  const { transport, calls } = wire(() => json(201, ORDER));
  const controller = api.createCheckoutController({
    post: transport.storeFetchResponse,
    getStorage: () => memoryStorage(),
    getGeneration: () => 1,
    onConfirmed: () => {}
  });
  const result = await controller.submit(request({ items: [{ sku_id: 5, quantity: 2, price: 1 }] }));
  assert.equal(result.outcome, "confirmed");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, "/store/orders");
  assert.equal(calls[0].method, "POST");
  assert.match(calls[0].auth, /^Bearer /);
  assert.deepEqual(JSON.parse(calls[0].body), { items: [{ sku_id: 5, quantity: 2 }], address_id: 11 });
});

test("a lost response through the real transport is one send and is not claimed as success", async () => {
  const { transport, calls } = wire(() => {
    throw new TypeError("fetch failed");
  });
  const controller = api.createCheckoutController({
    post: transport.storeFetchResponse,
    getStorage: () => memoryStorage(),
    getGeneration: () => 1,
    onConfirmed: () => assert.fail("a lost response must not clear the cart")
  });
  const result = await controller.submit(request());
  assert.equal(calls.length, 1, "the transport does not resend an order");
  assert.notEqual(result.outcome, "confirmed");
  assert.notEqual(controller.getState().phase, "confirmed");
});

// =====================================================================================================
// Task 2: stock conflicts, definite refusals and an outcome nobody saw (T-09-08-2, T-09-08-3)
// =====================================================================================================

const apiError = (status, payload, extra = {}) => new api.StoreApiError("x", { status, payload, ...extra });
const classify = (status, payload, extra) => api.classifyPlacementError(apiError(status, payload, extra));
const reject = (error) => async () => Promise.reject(error);

// ---- reading what the server answered --------------------------------------------------------------------

test("a top-level 409 STOCK_CHANGED names each affected product and its cap", () => {
  const c = classify(409, { code: "STOCK_CHANGED", message: "Stock changed", items: [{ sku_id: 5, max_quantity: 1 }, { sku_id: 7, max_quantity: 0 }] });
  assert.equal(c.outcome, "stock");
  assert.deepEqual(c.items, [{ sku_id: 5, max_quantity: 1 }, { sku_id: 7, max_quantity: 0 }]);
});

test("a malformed STOCK_CHANGED line is dropped, the rest kept, and the conflict still stands", () => {
  const c = classify(409, { code: "STOCK_CHANGED", items: [{ sku_id: 5, max_quantity: 2 }, { sku_id: "x", max_quantity: 1 }, { sku_id: 6, max_quantity: -3 }, { sku_id: 8 }, null, 4] });
  assert.equal(c.outcome, "stock");
  assert.deepEqual(c.items, [{ sku_id: 5, max_quantity: 2 }]);
  assert.equal(classify(409, { code: "STOCK_CHANGED" }).outcome, "stock", "no items array at all");
  assert.deepEqual(classify(409, { code: "STOCK_CHANGED" }).items, []);
});

test("a 409 that is not STOCK_CHANGED is a refusal, never a stock review", () => {
  const c = classify(409, { detail: "conflict" });
  assert.equal(c.outcome, "refused");
  assert.notEqual(c.kind, "stock");
});

test("a nested 422 names the products that are no longer sold, a string 422 is an invalid cart", () => {
  const gone = classify(422, { detail: { message: "Some products are not available", sku_ids: [3, 9, "x", 0] } });
  assert.equal(gone.outcome, "refused");
  assert.equal(gone.kind, "unavailable");
  assert.deepEqual(gone.skuIds, [3, 9]);
  const invalid = classify(422, { detail: "Cart is invalid" });
  assert.equal(invalid.outcome, "refused");
  assert.equal(invalid.kind, "invalid");
  assert.deepEqual(invalid.skuIds, []);
});

test("the store being closed, an address that is gone, a forbidden account and a rate limit are definite refusals", () => {
  assert.equal(classify(503, { detail: "Store is not taking orders right now" }).kind, "closed");
  assert.equal(classify(404, { detail: "Address not found" }).kind, "address");
  assert.equal(classify(403, { detail: "nope" }).kind, "denied");
  assert.equal(classify(429, { detail: "slow down" }).kind, "busy");
  for (const status of [403, 404, 422, 429]) assert.equal(classify(status, { detail: "x" }).outcome, "refused", String(status));
});

test("a refusal's words are fixed copy: nothing the server said is shown", () => {
  const c = classify(422, { detail: "SELECT * FROM secrets; internal error 0xDEAD" });
  assert.ok(c.message.length > 10);
  assert.doesNotMatch(c.message, /SELECT|0xDEAD|secrets/);
});

test("a gateway 503, a 500, a 502, a 504, a network failure and a 401 are all outcomes nobody saw", () => {
  const html = "<html>503 Service Unavailable</html>";
  for (const c of [
    classify(503, html),
    classify(503, { detail: "something else" }),
    classify(500, { detail: "boom" }),
    classify(502, null),
    classify(504, null),
    classify(0, { cause: "fetch failed" }, { reason: "network" }),
    classify(401, { detail: "Not authenticated" }),
    classify(302, null),
    api.classifyPlacementError(new Error("odd")),
    api.classifyPlacementError(null)
  ]) {
    assert.equal(c.outcome, "uncertain", JSON.stringify(c));
    assert.equal(c.message, api.PLACEMENT_COPY.uncertain);
  }
});

test("a request the transport never sent is a refusal that says so, and a stale one is dropped", () => {
  assert.equal(classify(0, null, { reason: "refresh-unavailable" }).kind, "not-sent");
  assert.equal(classify(401, null, { reason: "session-expired" }).kind, "signed-out");
  assert.equal(classify(401, null, { reason: "needs-login" }).kind, "signed-out");
  assert.equal(classify(0, null, { reason: "stale" }).outcome, "stale");
  for (const reason of ["refresh-unavailable", "session-expired", "needs-login"]) {
    assert.equal(classify(0, null, { reason }).outcome, "refused", reason);
  }
});

// ---- a stock conflict is reviewed, then the cart is requoted, then the person submits again -------------------

const CONFLICT = { code: "STOCK_CHANGED", message: "Stock changed for some items. Please review your cart.", items: [{ sku_id: 5, max_quantity: 1 }] };

test("a 409 puts the checkout in stock review and sends nothing more", async () => {
  const { controller, sent } = harness({ post: reject(apiError(409, CONFLICT)) });
  const result = await controller.submit(request());
  assert.equal(result.outcome, "stock");
  assert.equal(sent.length, 1);
  const state = controller.getState();
  assert.equal(state.phase, "stock-review");
  assert.deepEqual(state.review, [{ sku_id: 5, max_quantity: 1 }]);
  assert.equal(api.checkoutGate(gateInput({ view: state })).reason, "review");
});

test("while a stock review is open the same cart cannot be submitted again", async () => {
  const { controller, sent } = harness({ post: reject(apiError(409, CONFLICT)) });
  await controller.submit(request());
  const again = await controller.submit(request());
  assert.deepEqual([again.sent, again.reason], [false, "review-needed"]);
  assert.equal(sent.length, 1);
});

test("an edited cart (a newer revision) is a fresh submission, an explicit one", async () => {
  let calls = 0;
  const { controller, sent } = harness({
    post: async () => {
      calls += 1;
      if (calls === 1) throw apiError(409, CONFLICT);
      return { status: 201, body: ORDER };
    }
  });
  await controller.submit(request());
  controller.acceptReview();
  assert.equal(controller.getState().phase, "idle");
  const second = await controller.submit(request({ owner: { ...OWNER, revision: OWNER.revision + 1 }, items: [{ sku_id: 5, quantity: 1 }] }));
  assert.equal(second.outcome, "confirmed");
  assert.equal(sent.length, 2, "one explicit send each, never an automatic one");
  assert.deepEqual(sent[1].body.items, [{ sku_id: 5, quantity: 1 }]);
});

test("a review is shown only for the cart revision it was about", async () => {
  const { controller } = harness({ post: reject(apiError(409, CONFLICT)) });
  await controller.submit(request());
  const state = controller.getState();
  const me = { generation: 1, retailerId: 71 };
  assert.equal(api.checkoutView(state, me, OWNER.revision).phase, "stock-review");
  assert.equal(api.checkoutView(state, me, OWNER.revision + 1).phase, "idle", "the person edited the cart");
});

test("a refusal is shown for its cart, can be dismissed, and releases the lock", async () => {
  const { controller, sent } = harness({ post: reject(apiError(422, { detail: { message: "x", sku_ids: [5] } })) });
  const result = await controller.submit(request());
  assert.equal(result.outcome, "refused");
  assert.equal(controller.getState().phase, "refused");
  assert.deepEqual(controller.getState().problem.skuIds, [5]);
  controller.dismiss();
  assert.equal(controller.getState().phase, "idle");
  const again = await controller.submit(request());
  assert.equal(again.sent, true, "a definite refusal may be retried by the person");
  assert.equal(sent.length, 2);
});

// ---- applying a conflict to the cart: reduce or remove, never raise, never silently --------------------------------

test("a conflict lowers a line to what is available and removes a line with none", () => {
  let cart = updateCartQuantity(updateCartQuantity(updateCartQuantity(emptyCart(), 5, 4), 6, 2), 7, 3);
  cart = cartModule.applyStockConflict(cart, [{ sku_id: 5, max_quantity: 1 }, { sku_id: 7, max_quantity: 0 }]);
  assert.deepEqual(cart.lines.map((l) => [l.sku_id, l.quantity]), [[5, 1], [6, 2]]);
});

test("a conflict never raises a quantity and ignores products that are not in the cart", () => {
  const cart = updateCartQuantity(emptyCart(), 5, 2);
  const after = cartModule.applyStockConflict(cart, [{ sku_id: 5, max_quantity: 9 }, { sku_id: 99, max_quantity: 0 }, { sku_id: "x", max_quantity: 1 }, null]);
  assert.equal(after, cart, "nothing to change, so the same cart (and no new quote)");
});

test("an applied conflict is a new revision, so the earlier quote cannot be believed", () => {
  const cart = updateCartQuantity(emptyCart(), 5, 4);
  const after = cartModule.applyStockConflict(cart, [{ sku_id: 5, max_quantity: 1 }]);
  assert.ok(after.revision > cart.revision);
});

test("a quote that says a line is out of stock never enables Place order", () => {
  const cart = updateCartQuantity(emptyCart(), 5, 4);
  const quote = {
    lines: [{ sku_id: 5, quantity: 4, within_stock: false, max_orderable: 1, name: "Chips", line_total: 64 }],
    subtotal: 64,
    delivery_charge: 40,
    total: 104
  };
  const identity = { generation: 1, retailerId: 71 };
  const readiness = cartModule.cartReadiness({ cart, identity, record: { phase: "ready", identity, revision: cart.revision, quote } });
  assert.equal(readiness.state, "stock");
  assert.equal(api.checkoutGate(gateInput({ readiness })).canPlace, false);
});

// ---- an outcome nobody saw: one send, cart kept, no resend until the orders were read back ----------------------

const lostResponses = [
  ["a network failure", () => apiError(0, { cause: "fetch failed" }, { reason: "network" })],
  ["a 500", () => apiError(500, { detail: "boom" })],
  ["a gateway 503", () => apiError(503, "<html>503</html>")],
  ["a 401", () => apiError(401, { detail: "Not authenticated" })]
];

for (const [name, make] of lostResponses) {
  test(`${name} leaves the cart alone, is one send, and is not claimed as success`, async () => {
    const { controller, sent, confirmed } = harness({ post: reject(make()) });
    const result = await controller.submit(request());
    assert.equal(result.outcome, "uncertain");
    assert.equal(controller.getState().phase, "uncertain");
    assert.equal(confirmed.length, 0, "the cart is not cleared");
    assert.equal(sent.length, 1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(sent.length, 1, "the app never resends an order by itself");
  });
}

test("after an outcome nobody saw, Place order is refused until the orders have been read back", async () => {
  const { controller, sent } = harness({ post: reject(apiError(500, { detail: "boom" })) });
  await controller.submit(request());
  const again = await controller.submit(request());
  assert.deepEqual([again.sent, again.reason], [false, "unverified"]);
  assert.equal(sent.length, 1);
  assert.equal(api.checkoutGate(gateInput({ view: controller.getState() })).reason, "unverified");
});

test("the attempt is written down before it is sent, so a reload cannot forget it", async () => {
  const gate = deferred();
  const storage = memoryStorage();
  const { controller } = harness({ post: () => gate.promise, storage });
  const pending = controller.submit(request());
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.ok(storage.dump()["ascend_store_pending_order:71"], "written while the order is in flight");
  assert.equal(JSON.parse(storage.dump()["ascend_store_pending_order:71"]).at.length > 10, true);
  gate.resolve({ status: 201, body: ORDER });
  await pending;
  assert.equal(storage.dump()["ascend_store_pending_order:71"], undefined, "confirmed: nothing left to doubt");
});

test("a page reload during an unfinished order comes back as an unconfirmed order, and cannot resend", async () => {
  const storage = memoryStorage();
  const first = harness({ post: () => new Promise(() => {}), storage }); // never answers: the tab is closed
  first.controller.submit(request());
  await new Promise((resolve) => setTimeout(resolve, 5));
  const reloaded = harness({ storage });
  reloaded.controller.sync({ generation: 1, retailerId: 71 });
  assert.equal(reloaded.controller.getState().phase, "uncertain");
  const result = await reloaded.controller.submit(request());
  assert.deepEqual([result.sent, result.reason], [false, "unverified"]);
  assert.equal(reloaded.sent.length, 0);
});

test("the unconfirmed order belongs to the retailer, not to the browser: another retailer is not blocked", async () => {
  const storage = memoryStorage();
  const first = harness({ post: reject(apiError(500, null)), storage });
  await first.controller.submit(request());
  const other = harness({ storage });
  other.controller.sync({ generation: 2, retailerId: 88 });
  assert.equal(other.controller.getState().phase, "idle");
  const result = await other.controller.submit({ ...request(), owner: { generation: 1, retailerId: 88, revision: 1 } });
  assert.equal(result.outcome, "confirmed");
});

test("the same retailer signing in again is told about the unconfirmed order", async () => {
  const storage = memoryStorage();
  const first = harness({ post: reject(apiError(500, null)), storage });
  await first.controller.submit(request());
  first.controller.sync({ generation: 2, retailerId: 71 });
  assert.equal(first.controller.getState().phase, "uncertain");
  assert.equal(api.checkoutView(first.controller.getState(), { generation: 2, retailerId: 71 }, 1).phase, "uncertain");
  assert.equal(api.checkoutView(first.controller.getState(), { generation: 2, retailerId: 72 }, 1).phase, "idle");
});

test("a definite answer clears the written-down attempt: 409, a refusal and a request never sent", async () => {
  for (const error of [apiError(409, CONFLICT), apiError(422, { detail: "x" }), apiError(0, null, { reason: "refresh-unavailable" })]) {
    const storage = memoryStorage();
    const { controller } = harness({ post: reject(error), storage });
    await controller.submit(request());
    assert.equal(storage.dump()["ascend_store_pending_order:71"], undefined, `status ${error.status}`);
  }
});

test("an address check that fails or is refused never writes an attempt down", async () => {
  const storage = memoryStorage();
  const { controller } = harness({ storage });
  await controller.submit(request({ confirmAddress: async () => false }));
  assert.equal(storage.dump()["ascend_store_pending_order:71"], undefined);
});

test("storage that refuses writes does not stop an order, and the in-memory state still blocks a resend", async () => {
  const broken = {
    getItem: () => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("denied");
    },
    removeItem: () => {
      throw new Error("denied");
    }
  };
  const { controller, sent } = harness({ post: reject(apiError(500, null)), storage: broken });
  const result = await controller.submit(request());
  assert.equal(result.outcome, "uncertain");
  const again = await controller.submit(request());
  assert.equal(again.reason, "unverified");
  assert.equal(sent.length, 1);
});

test("a corrupt attempt record in storage is read as no attempt, not as a crash", () => {
  for (const raw of ["not json", "{}", "[]", "null", '{"at":5}']) {
    const storage = memoryStorage({ "ascend_store_pending_order:71": raw });
    assert.doesNotThrow(() => api.readPendingOrder(storage, 71));
  }
  assert.equal(api.readPendingOrder(memoryStorage({ "ascend_store_pending_order:71": "not json" }), 71), null);
  assert.equal(api.readPendingOrder(null, 71), null);
  assert.equal(api.readPendingOrder(memoryStorage(), "abc"), null);
});

// ---- reading the orders back before any resend ---------------------------------------------------------------------

const orderRow = (id, extra = {}) => ({ id, status: "PENDING", created_at: "2026-10-02T10:00:00Z", item_count: 1, total: 72, delivery_charge: 40, invoice_available: false, ...extra });

async function uncertainHarness(options = {}) {
  const calls = [];
  const h = harness({
    post: reject(apiError(500, null)),
    get: options.get || (async (path) => {
      calls.push(path);
      return { items: [orderRow(5003), orderRow(5002), orderRow(5001), orderRow(5000)], total: 4 };
    }),
    storage: options.storage
  });
  await h.controller.submit(request());
  return { ...h, getCalls: calls };
}

test("checking My orders asks for the newest three, once, with a read", async () => {
  const { controller, getCalls } = await uncertainHarness();
  await controller.checkOrders();
  assert.equal(getCalls.length, 1);
  assert.equal(getCalls[0], "/store/orders?limit=3&offset=0");
  const { check } = controller.getState();
  assert.equal(check.phase, "ready");
  assert.deepEqual(check.orders.map((o) => o.id), [5003, 5002, 5001]);
  assert.equal(controller.getState().phase, "uncertain", "reading is not deciding");
});

test("a failed read-back is an error that can be tried again, and nothing is inferred from it", async () => {
  let fail = true;
  const { controller } = await uncertainHarness({
    get: async () => {
      if (fail) throw apiError(0, null, { reason: "network" });
      return { items: [], total: 0 };
    }
  });
  await controller.checkOrders();
  assert.equal(controller.getState().check.phase, "error");
  assert.equal((await controller.resolveUncertain()), false, "an unread list cannot release the lock");
  fail = false;
  await controller.checkOrders();
  assert.equal(controller.getState().check.phase, "ready");
  assert.equal(controller.getState().check.total, 0);
});

test("an answer that is not an order list is an error, not an empty list", async () => {
  const { controller } = await uncertainHarness({ get: async () => ({ nope: true }) });
  await controller.checkOrders();
  assert.equal(controller.getState().check.phase, "error");
});

test("a read-back only counts for the account that asked, and a late answer is dropped", async () => {
  const gate = deferred();
  const { controller, state } = await uncertainHarness({ get: () => gate.promise });
  const reading = controller.checkOrders();
  state.generation = 2;
  controller.sync({ generation: 2, retailerId: 88 });
  gate.resolve({ items: [orderRow(1)], total: 1 });
  await reading;
  assert.equal(controller.getState().phase, "idle");
  assert.equal(controller.getState().check, null);
});

test("an order cannot be sent again until the person says so after a successful read-back", async () => {
  const { controller, sent } = await uncertainHarness();
  assert.equal(controller.resolveUncertain(), false, "nothing was read yet");
  await controller.checkOrders();
  assert.equal(controller.resolveUncertain(), true);
  assert.equal(controller.getState().phase, "idle");
  assert.equal(sent.length, 1, "resolving sends nothing");
});

test("after the read-back and an explicit release, the next Place order is one fresh send", async () => {
  let calls = 0;
  const h = harness({
    post: async () => {
      calls += 1;
      if (calls === 1) throw apiError(500, null);
      return { status: 201, body: ORDER };
    },
    get: async () => ({ items: [], total: 0 })
  });
  await h.controller.submit(request());
  await h.controller.checkOrders();
  h.controller.resolveUncertain();
  const result = await h.controller.submit(request());
  assert.equal(result.outcome, "confirmed");
  assert.equal(h.sent.length, 2);
  assert.equal(h.storage.dump()["ascend_store_pending_order:71"], undefined);
});

test("the release also clears the written-down attempt, so a reload does not bring the doubt back", async () => {
  const storage = memoryStorage();
  const { controller } = await uncertainHarness({ storage });
  assert.ok(storage.dump()["ascend_store_pending_order:71"]);
  await controller.checkOrders();
  controller.resolveUncertain();
  assert.equal(storage.dump()["ascend_store_pending_order:71"], undefined);
});

test("reading the orders is only possible while an outcome is unconfirmed", async () => {
  const h = harness({ get: async () => assert.fail("nothing to check") });
  await h.controller.checkOrders();
  assert.equal(h.controller.getState().phase, "idle");
});

// ---- stale answers never touch another account (T-09-08-3) -------------------------------------------------------------

test("a conflict, a refusal or a lost answer that arrives after the account changed shows nothing to the new account", async () => {
  for (const error of [apiError(409, CONFLICT), apiError(422, { detail: "x" }), apiError(500, null)]) {
    const gate = deferred();
    const { controller, state } = harness({ post: () => gate.promise });
    const pending = controller.submit(request());
    state.generation = 2;
    controller.sync({ generation: 2, retailerId: 88 });
    gate.reject(error);
    await pending;
    assert.equal(controller.getState().phase, "idle", `status ${error.status}`);
    assert.equal(controller.getState().owner, null);
  }
});

test("an order that may have gone through while the account changed is still remembered for its retailer", async () => {
  const storage = memoryStorage();
  const gate = deferred();
  const { controller, state } = harness({ post: () => gate.promise, storage });
  const pending = controller.submit(request());
  state.generation = 2;
  gate.reject(new api.StoreApiError("changed", { reason: "stale" }));
  await pending;
  assert.ok(storage.dump()["ascend_store_pending_order:71"], "the transport dropped the answer; the order may exist");
  const back = harness({ storage });
  back.controller.sync({ generation: 3, retailerId: 71 });
  assert.equal(back.controller.getState().phase, "uncertain");
});

// ---- the wire: what the real transport does with these answers -------------------------------------------------------------

function realWire(route, { expired = false } = {}) {
  const storage = memoryStorage();
  const session = createRetailerSession({ getStorage: () => storage, eventTarget: null });
  const exp = Math.floor(Date.now() / 1000) + (expired ? -100 : 3600);
  const tok = `${b64url({ alg: "none" })}.${b64url({ user_id: 71, role: "RETAILER", tv: 0, exp })}.sig`;
  session.save({ accessToken: tok, refreshToken: "refresh-1" });
  const calls = [];
  const transport = api.createStoreTransport({
    session,
    baseUrl: "http://api.test",
    fetch: async (url, init = {}) => {
      const call = { path: new URL(url).pathname + new URL(url).search, method: (init.method || "GET").toUpperCase() };
      calls.push(call);
      return route(call);
    }
  });
  const controller = api.createCheckoutController({
    post: transport.storeFetchResponse,
    get: transport.storeFetch,
    parseOrderList: normalizeOrderList,
    getStorage: () => memoryStorage(),
    getGeneration: () => session.getGeneration()
  });
  return { controller, calls, session };
}

const wireRequest = (session) => ({ owner: { generation: session.getGeneration(), retailerId: 71, revision: 1 }, items: ITEMS, addressId: 11 });

test("a 401 on the order is one POST, never replayed, and is an outcome nobody saw", async () => {
  const { controller, calls, session } = realWire((call) => {
    if (call.path === "/auth/refresh") return json(200, { access_token: accessToken(), refresh_token: "refresh-2" });
    return json(401, { detail: "Not authenticated" });
  });
  const result = await controller.submit(wireRequest(session));
  assert.equal(result.outcome, "uncertain");
  assert.equal(calls.filter((c) => c.path === "/store/orders").length, 1, "the order is not replayed after the refresh");
});

test("a refresh that fails before the send means the order was never sent, and says so", async () => {
  const { controller, calls, session } = realWire(() => json(503, { detail: "down" }), { expired: true });
  const result = await controller.submit(wireRequest(session));
  assert.equal(calls.filter((c) => c.path === "/store/orders").length, 0);
  assert.equal(result.outcome, "refused");
  assert.equal(controller.getState().problem.kind, "not-sent");
});

test("a 409 through the real transport keeps its raw top-level items and opens a review", async () => {
  const { controller, session } = realWire(() => json(409, CONFLICT));
  const result = await controller.submit(wireRequest(session));
  assert.equal(result.outcome, "stock");
  assert.deepEqual(controller.getState().review, [{ sku_id: 5, max_quantity: 1 }]);
});

test("the read-back through the real transport is a GET that may be repeated, the order is not", async () => {
  const { controller, calls, session } = realWire((call) => {
    if (call.method === "POST") return json(500, { detail: "boom" });
    return json(200, { items: [orderRow(5001)], total: 1 });
  });
  await controller.submit(wireRequest(session));
  await controller.checkOrders();
  assert.equal(calls.filter((c) => c.method === "POST").length, 1);
  assert.deepEqual(calls.filter((c) => c.method === "GET").map((c) => c.path), ["/store/orders?limit=3&offset=0"]);
  assert.equal(controller.getState().check.orders[0].id, 5001);
});
