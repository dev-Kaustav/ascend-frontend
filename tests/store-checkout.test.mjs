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
function harness({ post, storage = memoryStorage(), generation = 1 } = {}) {
  const state = { generation };
  const sent = [];
  const confirmed = [];
  const controller = api.createCheckoutController({
    post: (path, init) => {
      sent.push({ path, method: init.method, body: JSON.parse(init.body) });
      return post ? post(path, init) : Promise.resolve({ status: 201, body: ORDER });
    },
    get: () => Promise.reject(new Error("the tracer never reads orders")),
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
