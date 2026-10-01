// Behaviour tests for the storefront transport. node:test, no framework, no network:
//
//   node --test tests/store-api.test.mjs
//
// The transport is driven through createStoreTransport with an injected session (fake storage)
// and an injected fetch, so every assertion is about what the real code sends and returns.
// The backend is mocked on purpose: the local database is a restored production copy, and the
// order, quote and refresh endpoints must not be called against real accounts.
import assert from "node:assert/strict";
import { test } from "node:test";
import * as api from "../lib/store/api.mjs";
import { createRetailerSession } from "../lib/store/session.mjs";

const { StoreApiError, storeEndpoints } = api;
const STAFF_KEYS = ["ascend_access_token", "ascend_refresh_token"];

const b64url = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const nowSeconds = () => Math.floor(Date.now() / 1000);
const token = (userId, expOffset = 3600, serial = 0) =>
  `${b64url({ alg: "none" })}.${b64url({ user_id: userId, role: "RETAILER", tv: 0, exp: nowSeconds() + expOffset, n: serial })}.sig`;

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  const touched = [];
  return {
    data,
    touched,
    getItem: (key) => (touched.push(key), data.has(key) ? data.get(key) : null),
    setItem: (key, value) => (touched.push(key), void data.set(key, String(value))),
    removeItem: (key) => (touched.push(key), void data.delete(key))
  };
}

const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

function deferred() {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
}

// route(call) -> Response | Promise<Response> | throws. calls records everything sent.
function setup(route, { signedIn = { user: 7, expOffset: 3600, refresh: "refresh-1" }, staff = true } = {}) {
  const storage = fakeStorage(staff ? { [STAFF_KEYS[0]]: "staff-access", [STAFF_KEYS[1]]: "staff-refresh" } : {});
  const session = createRetailerSession({ getStorage: () => storage, eventTarget: null });
  if (signedIn) {
    session.save({ accessToken: token(signedIn.user, signedIn.expOffset), refreshToken: signedIn.refresh });
  }
  const calls = [];
  const transport = api.createStoreTransport({
    session,
    baseUrl: "http://api.test",
    fetch: async (url, init = {}) => {
      const headers = new Headers(init.headers);
      const call = {
        url,
        path: new URL(url).pathname,
        method: (init.method || "GET").toUpperCase(),
        auth: headers.get("authorization"),
        body: init.body,
        cache: init.cache
      };
      calls.push(call);
      return route(call);
    }
  });
  const sent = (method, path) => calls.filter((c) => c.method === method && c.path === path);
  return { transport, session, storage, calls, sent };
}

let serial = 0;
const refreshOk = (user = 7) => json(200, { access_token: token(user, 3600, ++serial), refresh_token: `refresh-${user}-${serial}` });
const rejects = async (promise, check) => {
  let caught = null;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  assert.ok(caught, "expected the request to reject");
  check(caught);
  return caught;
};

// --- Contracts --------------------------------------------------------------------------

test("storeEndpoints cover catalogue, shop, addresses, quote, orders, invoice and auth", () => {
  assert.equal(storeEndpoints.products, "/store/products");
  assert.equal(storeEndpoints.product("a b"), "/store/products/a%20b");
  assert.equal(storeEndpoints.categories, "/store/categories");
  assert.equal(storeEndpoints.brands, "/store/brands");
  assert.equal(storeEndpoints.me, "/store/me");
  assert.equal(storeEndpoints.shop, "/store/me/shop");
  assert.equal(storeEndpoints.addresses, "/store/me/addresses");
  assert.equal(storeEndpoints.address(5), "/store/me/addresses/5");
  assert.equal(storeEndpoints.quote, "/store/cart/quote");
  assert.equal(storeEndpoints.orders, "/store/orders");
  assert.equal(storeEndpoints.order(9), "/store/orders/9");
  assert.equal(storeEndpoints.invoicePdf(9), "/store/orders/9/invoice.pdf");
  assert.equal(storeEndpoints.authExchange, "/auth/retailer/firebase");
  assert.equal(storeEndpoints.authRefresh, "/auth/refresh");
});

test("a 204 returns null without reading or parsing a body", async () => {
  const { transport } = setup(() => ({
    ok: true,
    status: 204,
    headers: new Headers(),
    text: () => assert.fail("a 204 must not be read"),
    json: () => assert.fail("a 204 must not be parsed")
  }));
  assert.equal(await transport.storeFetch("/store/me/addresses/3", { method: "DELETE" }), null);
});

test("409 STOCK_CHANGED keeps its top-level code and items", async () => {
  const body = {
    code: "STOCK_CHANGED",
    message: "Stock changed for some items. Please review your cart.",
    items: [{ sku_id: 4, max_quantity: 2 }]
  };
  const { transport } = setup(() => json(409, body));
  const error = await rejects(transport.storeFetch(storeEndpoints.orders, { method: "POST", body: "{}" }), (e) => {
    assert.ok(e instanceof StoreApiError);
    assert.equal(e.status, 409);
  });
  assert.deepEqual(error.payload, body);
  assert.equal(error.payload.code, "STOCK_CHANGED");
  assert.deepEqual(error.payload.items, [{ sku_id: 4, max_quantity: 2 }]);
  assert.equal(error.message, body.message);
});

test("422 with a nested detail keeps unknown sku_ids and uses its message", async () => {
  const body = { detail: { message: "Some products are not available", sku_ids: [3, 9] } };
  const { transport } = setup(() => json(422, body));
  const error = await rejects(transport.storeFetch(storeEndpoints.quote, { method: "POST", body: "{}" }), () => {});
  assert.deepEqual(error.payload.detail.sku_ids, [3, 9]);
  assert.equal(error.message, "Some products are not available");
  assert.equal(error.status, 422);
});

test("a 422 validation array and a non-JSON error body are both retained raw", async () => {
  const array = [{ loc: ["body", "address_id"], msg: "field required" }];
  let setupResult = setup(() => json(422, { detail: array }));
  let error = await rejects(setupResult.transport.storeFetch(storeEndpoints.orders, { method: "POST", body: "{}" }), () => {});
  assert.deepEqual(error.payload.detail, array);
  assert.equal(error.message, "Request failed (422)");

  setupResult = setup(() => new Response("Bad gateway", { status: 502 }));
  error = await rejects(setupResult.transport.storeFetch(storeEndpoints.me), () => {});
  assert.equal(error.payload, "Bad gateway");
  assert.equal(error.status, 502);
});

test("429 exposes Retry-After as seconds", async () => {
  const { transport } = setup(() => json(429, { detail: "Too many attempts" }, { "retry-after": "30" }));
  const error = await rejects(transport.storeFetch(storeEndpoints.me), () => {});
  assert.equal(error.status, 429);
  assert.equal(error.retryAfter, 30);
  assert.equal(error.message, "Too many attempts");
});

test("a missing or unreadable Retry-After is null", async () => {
  const { transport } = setup(() => json(429, { detail: "Slow down" }));
  const error = await rejects(transport.storeFetch(storeEndpoints.me), () => {});
  assert.equal(error.retryAfter, null);
});

test("every request is no-store", async () => {
  const { transport, calls } = setup(() => json(200, {}));
  await transport.storeFetch(storeEndpoints.me);
  await transport.storeFetch(storeEndpoints.products, { public: true });
  assert.ok(calls.length === 2 && calls.every((c) => c.cache === "no-store"));
});

// --- PDF / blob -------------------------------------------------------------------------

const pdf = (disposition) =>
  new Response(new Blob(["%PDF-1.4 fake"], { type: "application/pdf" }), {
    status: 200,
    headers: { "content-type": "application/pdf", ...(disposition ? { "content-disposition": disposition } : {}) }
  });

test("storeFetchBlob returns the blob and the filename from Content-Disposition", async () => {
  const { transport, calls } = setup(() => pdf('attachment; filename="invoice-INV-0042.pdf"'));
  const { blob, filename } = await transport.storeFetchBlob(storeEndpoints.invoicePdf(9));
  assert.equal(filename, "invoice-INV-0042.pdf");
  assert.equal(await blob.text(), "%PDF-1.4 fake");
  assert.match(calls[0].auth, /^Bearer /, "the invoice is a private download");
});

test("blob filenames: RFC 5987, unquoted, path-stripped, and a fallback", async () => {
  const cases = [
    ["attachment; filename*=UTF-8''invoice%20No%207.pdf", "invoice No 7.pdf"],
    ["attachment; filename=plain.pdf", "plain.pdf"],
    ['attachment; filename="../../etc/passwd"', "passwd"],
    [null, "download"]
  ];
  for (const [header, expected] of cases) {
    const { transport } = setup(() => pdf(header));
    assert.equal((await transport.storeFetchBlob("/store/orders/1/invoice.pdf")).filename, expected, String(header));
  }
});

test("a blob request that fails keeps the server's message and status", async () => {
  const { transport } = setup(() => json(404, { detail: "No invoice yet" }));
  const error = await rejects(transport.storeFetchBlob(storeEndpoints.invoicePdf(9)), () => {});
  assert.equal(error.status, 404);
  assert.equal(error.message, "No invoice yet");
});

test("a blob GET that 401s refreshes once and is repeated", async () => {
  let initial = null;
  const ctx = setup((call) => {
    if (call.path === "/auth/refresh") return refreshOk();
    return call.auth === `Bearer ${initial}` ? json(401, { detail: "expired" }) : pdf('attachment; filename="invoice-9.pdf"');
  });
  initial = ctx.session.getAccessToken();
  const { filename } = await ctx.transport.storeFetchBlob(storeEndpoints.invoicePdf(9));
  assert.equal(filename, "invoice-9.pdf");
  assert.equal(ctx.sent("POST", "/auth/refresh").length, 1);
  assert.equal(ctx.sent("GET", "/store/orders/9/invoice.pdf").length, 2);
});

// --- Public requests --------------------------------------------------------------------

test("public mode never sends a bearer and never refreshes, even with a retailer session", async () => {
  const { transport, calls } = setup(() => json(401, { detail: "nope" }));
  await rejects(transport.storeFetch(storeEndpoints.products, { public: true }), (e) => assert.equal(e.status, 401));
  assert.equal(calls.length, 1, "no refresh and no replay");
  assert.equal(calls[0].auth, null);
});

test("a private request with no session sends nothing and asks for sign-in", async () => {
  const { transport, calls } = setup(() => json(200, {}), { signedIn: null });
  await rejects(transport.storeFetch(storeEndpoints.me), (e) => {
    assert.equal(e.reason, "needs-login");
    assert.equal(e.status, 401);
  });
  assert.equal(calls.length, 0);
});

// --- Refresh semantics ------------------------------------------------------------------

test("concurrent 401s share one refresh and each request is repeated once", async () => {
  const gate = deferred();
  let initial = null;
  const { transport, sent, session } = setup(async (call) => {
    if (call.path === "/auth/refresh") {
      await gate.promise;
      return refreshOk();
    }
    return call.auth === `Bearer ${initial}` ? json(401, { detail: "expired" }) : json(200, { ok: true });
  });
  initial = session.getAccessToken();
  const requests = [1, 2, 3].map(() => transport.storeFetch(storeEndpoints.me));
  await new Promise((r) => setTimeout(r, 20)); // all three have 401'd and are waiting on the refresh
  gate.resolve();
  const results = await Promise.all(requests);

  assert.deepEqual(results, [{ ok: true }, { ok: true }, { ok: true }]);
  assert.equal(sent("POST", "/auth/refresh").length, 1, "one refresh for three 401s");
  assert.equal(sent("GET", "/store/me").length, 6, "three first attempts and three replays");
});

test("a request whose 401 arrives after another request already refreshed is repeated without a second refresh", async () => {
  const slow = deferred();
  const first = token(7, 3600, 1);
  let sentSlow = false;
  const { transport, sent, session } = setup(
    async (call) => {
      if (call.path === "/auth/refresh") return refreshOk();
      if (call.auth === `Bearer ${first}` && !sentSlow) {
        sentSlow = true;
        await slow.promise; // the slow request, sent with the old token
        return json(401, { detail: "expired" });
      }
      return call.auth === `Bearer ${first}` ? json(401, { detail: "expired" }) : json(200, { ok: true });
    },
    { signedIn: null }
  );
  session.save({ accessToken: first, refreshToken: "refresh-1" });

  const slowRequest = transport.storeFetch(storeEndpoints.me); // sent first, held open
  await new Promise((r) => setTimeout(r, 10));
  const fastRequest = transport.storeFetch(storeEndpoints.orders); // 401, refreshes, replays
  assert.deepEqual(await fastRequest, { ok: true });
  slow.resolve();
  assert.deepEqual(await slowRequest, { ok: true });
  assert.equal(sent("POST", "/auth/refresh").length, 1);
});

test("an expired access token is refreshed before the request is sent", async () => {
  const { transport, sent } = setup(
    (call) => (call.path === "/auth/refresh" ? refreshOk() : json(200, { ok: true })),
    { signedIn: { user: 7, expOffset: -60, refresh: "refresh-1" } }
  );
  await transport.storeFetch(storeEndpoints.me);
  assert.equal(sent("POST", "/auth/refresh").length, 1);
  const attempts = sent("GET", "/store/me");
  assert.equal(attempts.length, 1, "the dead token is never used");
  assert.notEqual(attempts[0].auth, `Bearer ${token(7, -60)}`);
});

test("a refresh that lands after logout cannot resurrect the session", async () => {
  const gate = deferred();
  const { transport, session, sent } = setup(
    async (call) => {
      if (call.path === "/auth/refresh") {
        await gate.promise;
        return refreshOk();
      }
      return json(200, { ok: true });
    },
    { signedIn: { user: 7, expOffset: -60, refresh: "refresh-1" } }
  );
  const request = transport.storeFetch(storeEndpoints.me);
  await new Promise((r) => setTimeout(r, 10));
  session.clear(); // logout while the refresh is in flight
  gate.resolve();

  await rejects(request, (e) => assert.equal(e.reason, "stale"));
  assert.equal(session.getAccessToken(), null);
  assert.equal(session.getRefreshToken(), null);
  assert.equal(sent("GET", "/store/me").length, 0, "nothing is sent for a logged-out identity");
});

test("a response that lands after an account switch is discarded", async () => {
  const gate = deferred();
  const { transport, session } = setup(async () => {
    await gate.promise;
    return json(200, { shop: "belongs to the previous account" });
  });
  const request = transport.storeFetch(storeEndpoints.me);
  await new Promise((r) => setTimeout(r, 10));
  session.save({ accessToken: token(8), refreshToken: "refresh-8" });
  gate.resolve();
  await rejects(request, (e) => assert.equal(e.reason, "stale"));
});

test("a refused refresh token expires only the retailer session", async () => {
  const { transport, session, storage, sent } = setup(() => json(401, { detail: "Invalid refresh token" }), {
    signedIn: { user: 7, expOffset: -60, refresh: "refresh-1" }
  });
  await rejects(transport.storeFetch(storeEndpoints.me), (e) => {
    assert.equal(e.reason, "session-expired");
    assert.equal(e.status, 401);
  });
  assert.equal(session.getSnapshot().expired, true);
  assert.equal(session.getAccessToken(), null);
  assert.equal(sent("GET", "/store/me").length, 0);
  assert.equal(storage.data.get(STAFF_KEYS[0]), "staff-access");
  assert.equal(storage.data.get(STAFF_KEYS[1]), "staff-refresh");
  assert.ok(!storage.touched.some((key) => STAFF_KEYS.includes(key)), "staff storage is never touched");
});

test("a refresh that cannot be reached keeps the session and says so", async () => {
  for (const respond of [() => json(503, { detail: "down" }), () => json(429, {}, { "retry-after": "5" }), () => Promise.reject(new TypeError("offline"))]) {
    const { transport, session, sent } = setup(
      (call) => (call.path === "/auth/refresh" ? respond() : json(200, {})),
      { signedIn: { user: 7, expOffset: -60, refresh: "refresh-1" } }
    );
    await rejects(transport.storeFetch(storeEndpoints.me), (e) => assert.equal(e.reason, "refresh-unavailable"));
    assert.ok(session.getRefreshToken(), "a transient failure must not sign the retailer out");
    assert.equal(session.getSnapshot().expired, false);
    assert.equal(sent("GET", "/store/me").length, 0);
  }
});

test("a GET that 401s twice does not loop", async () => {
  const { transport, sent } = setup((call) => (call.path === "/auth/refresh" ? refreshOk() : json(401, { detail: "still no" })));
  await rejects(transport.storeFetch(storeEndpoints.me), (e) => assert.equal(e.status, 401));
  assert.equal(sent("GET", "/store/me").length, 2);
  assert.equal(sent("POST", "/auth/refresh").length, 1);
});

test("the read-only quote may be repeated once after a refresh", async () => {
  let attempt = 0;
  const { transport, sent } = setup((call) => {
    if (call.path === "/auth/refresh") return refreshOk();
    return ++attempt === 1 ? json(401, { detail: "expired" }) : json(200, { total: 123 });
  });
  const result = await transport.storeFetch(storeEndpoints.quote, { method: "POST", body: JSON.stringify({ items: [] }) });
  assert.deepEqual(result, { total: 123 });
  assert.equal(sent("POST", "/store/cart/quote").length, 2);
});

// --- Order placement: never replayed ----------------------------------------------------

const order = (transport) =>
  transport.storeFetch(storeEndpoints.orders, { method: "POST", body: JSON.stringify({ items: [{ sku_id: 1, quantity: 1 }], address_id: 2 }) });

test("an order that 401s is sent once, never repeated, and the credentials are recovered for the retry", async () => {
  const { transport, sent, session } = setup((call) => (call.path === "/auth/refresh" ? refreshOk() : json(401, { detail: "expired" })));
  const before = session.getAccessToken();
  await rejects(order(transport), (e) => assert.equal(e.status, 401));
  assert.equal(sent("POST", "/store/orders").length, 1, "exactly one order send");
  assert.equal(sent("POST", "/auth/refresh").length, 1);
  assert.notEqual(session.getAccessToken(), before, "the next, user-initiated attempt has a fresh token");
});

test("an order that 401s with a refused refresh expires the session after one send", async () => {
  const { transport, sent, session } = setup((call) => (call.path === "/auth/refresh" ? json(401, {}) : json(401, { detail: "expired" })));
  await rejects(order(transport), (e) => assert.equal(e.status, 401));
  assert.equal(sent("POST", "/store/orders").length, 1);
  assert.equal(session.getSnapshot().expired, true);
});

test("an order lost to a network failure is sent once and not repeated", async () => {
  const { transport, sent } = setup(() => Promise.reject(new TypeError("Failed to fetch")));
  await rejects(order(transport), (e) => {
    assert.equal(e.reason, "network");
    assert.equal(e.status, 0);
  });
  assert.equal(sent("POST", "/store/orders").length, 1);
});

test("an order answered with a 5xx is sent once and not repeated", async () => {
  const { transport, sent } = setup(() => json(503, { detail: "Store is not taking orders right now" }));
  await rejects(order(transport), (e) => assert.equal(e.status, 503));
  assert.equal(sent("POST", "/store/orders").length, 1);
});

test("an order with an expired token refreshes first and is then sent exactly once with the new token", async () => {
  const { transport, sent } = setup(
    (call) => (call.path === "/auth/refresh" ? refreshOk() : json(201, { id: 55 })),
    { signedIn: { user: 7, expOffset: -60, refresh: "refresh-1" } }
  );
  assert.deepEqual(await order(transport), { id: 55 });
  const posts = sent("POST", "/store/orders");
  assert.equal(posts.length, 1);
  assert.notEqual(posts[0].auth, `Bearer ${token(7, -60)}`);
  assert.equal(sent("POST", "/auth/refresh").length, 1);
});

test("an order is not sent at all when the session is already known to be dead", async () => {
  const { transport, sent } = setup(() => json(401, {}), { signedIn: { user: 7, expOffset: -60, refresh: "refresh-1" } });
  await rejects(order(transport), (e) => assert.equal(e.reason, "session-expired"));
  assert.equal(sent("POST", "/store/orders").length, 0);
});

test("a stock conflict on order placement is one send with the raw conflict", async () => {
  const conflict = { code: "STOCK_CHANGED", message: "Stock changed", items: [{ sku_id: 1, max_quantity: 0 }] };
  const { transport, sent } = setup(() => json(409, conflict));
  const error = await rejects(order(transport), () => {});
  assert.deepEqual(error.payload, conflict);
  assert.equal(sent("POST", "/store/orders").length, 1);
});

test("session expiry in the transport never navigates or touches staff storage", async () => {
  const { transport, storage } = setup(() => json(401, {}), { signedIn: { user: 7, expOffset: -60, refresh: "refresh-1" } });
  await rejects(transport.storeFetch(storeEndpoints.me), () => {});
  assert.equal(typeof globalThis.location, "undefined", "no browser location exists to redirect");
  assert.ok(!storage.touched.some((key) => STAFF_KEYS.includes(key)));
});
