// Behaviour tests for the retailer session. node:test, no framework, no network:
//
//   node --test tests/store-session.test.mjs
//
// Every test drives the real exports from lib/store/session.mjs against an injected storage
// and event target. Nothing here talks to the API or touches a real browser.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RETAILER_ACCESS_KEY,
  RETAILER_REFRESH_KEY,
  createRetailerSession,
  deriveRetailerState,
  isRetailerTokenExpired,
  parseRetailerIdentity,
  validateRetailerIntent
} from "../lib/store/session.mjs";

const STAFF_ACCESS = "ascend_access_token";
const STAFF_REFRESH = "ascend_refresh_token";

function b64url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function jwt(claims) {
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(claims)}.sig`;
}

const retailerToken = (userId = 7, extra = {}) => jwt({ user_id: userId, role: "RETAILER", tv: 0, ...extra });
const staffToken = () => jwt({ user_id: 1, role: "ADMIN", tv: 0 });

// A Storage stand-in that records every key it is asked about.
function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  const log = { gets: [], sets: [], removes: [] };
  return {
    data,
    log,
    failWrites: false,
    failReads: false,
    failRemoves: false,
    getItem(key) {
      log.gets.push(key);
      if (this.failReads) throw new Error("read blocked");
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      log.sets.push(key);
      if (this.failWrites) throw new Error("quota");
      data.set(key, String(value));
    },
    removeItem(key) {
      log.removes.push(key);
      if (this.failRemoves) throw new Error("remove blocked");
      data.delete(key);
    }
  };
}

function fakeWindowEvents() {
  const listeners = new Set();
  return {
    addEventListener: (type, fn) => type === "storage" && listeners.add(fn),
    removeEventListener: (type, fn) => type === "storage" && listeners.delete(fn),
    emit: (event) => listeners.forEach((fn) => fn(event))
  };
}

function makeSession(initial, { events = fakeWindowEvents() } = {}) {
  const storage = fakeStorage(initial);
  const session = createRetailerSession({ getStorage: () => storage, eventTarget: events });
  return { storage, session, events };
}

test("saving and clearing touch only the store keys; staff keys survive", () => {
  const { storage, session } = makeSession({ [STAFF_ACCESS]: "staff-a", [STAFF_REFRESH]: "staff-r" });
  const access = retailerToken();
  session.save({ accessToken: access, refreshToken: "store-r" });

  assert.equal(storage.data.get(RETAILER_ACCESS_KEY), access);
  assert.equal(storage.data.get(RETAILER_REFRESH_KEY), "store-r");
  assert.equal(storage.data.get(STAFF_ACCESS), "staff-a");

  session.clear();
  assert.equal(storage.data.has(RETAILER_ACCESS_KEY), false);
  assert.equal(storage.data.has(RETAILER_REFRESH_KEY), false);
  assert.equal(storage.data.get(STAFF_ACCESS), "staff-a");
  assert.equal(storage.data.get(STAFF_REFRESH), "staff-r");

  const touched = [...storage.log.gets, ...storage.log.sets, ...storage.log.removes];
  assert.ok(!touched.includes(STAFF_ACCESS) && !touched.includes(STAFF_REFRESH), "staff keys must never be read or written");
});

test("a visitor with only staff tokens stays anonymous in the store", () => {
  const { session } = makeSession({ [STAFF_ACCESS]: staffToken(), [STAFF_REFRESH]: "staff-r" });
  const snapshot = session.getSnapshot();
  assert.equal(snapshot.accessToken, null);
  assert.equal(snapshot.refreshToken, null);
  assert.equal(deriveRetailerState(snapshot, undefined).status, "anonymous");
});

test("logout before a refresh completes blocks credential resurrection", () => {
  const { session } = makeSession();
  session.save({ accessToken: retailerToken(7), refreshToken: "r1" });
  const generation = session.getGeneration();

  session.clear(); // user logs out while the refresh request is still in flight
  const committed = session.rotate({ accessToken: retailerToken(7), refreshToken: "r2" }, generation);

  assert.equal(committed, false);
  assert.equal(session.getAccessToken(), null);
  assert.equal(session.getRefreshToken(), null);
  assert.ok(session.getGeneration() > generation);
});

test("switching accounts invalidates a late refresh for the previous account", () => {
  const { session } = makeSession();
  session.save({ accessToken: retailerToken(7), refreshToken: "a-r1" });
  const aGeneration = session.getGeneration();

  session.save({ accessToken: retailerToken(8), refreshToken: "b-r1" }); // another retailer signs in
  const late = session.rotate({ accessToken: retailerToken(7), refreshToken: "a-r2" }, aGeneration);

  assert.equal(late, false);
  assert.equal(parseRetailerIdentity(session.getAccessToken()).userId, 8);
  assert.equal(session.getRefreshToken(), "b-r1");
});

test("a rotation for the current session keeps the generation, so in-flight work survives it", () => {
  const { session } = makeSession();
  session.save({ accessToken: retailerToken(7), refreshToken: "r1" });
  const generation = session.getGeneration();
  const next = retailerToken(7, { exp: 4102444800 });

  assert.equal(session.rotate({ accessToken: next, refreshToken: "r2" }, generation), true);
  assert.equal(session.getGeneration(), generation);
  assert.equal(session.getAccessToken(), next);
  assert.equal(session.getRefreshToken(), "r2");
});

test("a rotation that would change the account is refused", () => {
  const { session } = makeSession();
  session.save({ accessToken: retailerToken(7), refreshToken: "r1" });
  const generation = session.getGeneration();
  assert.equal(session.rotate({ accessToken: retailerToken(99), refreshToken: "r2" }, generation), false);
  assert.equal(parseRetailerIdentity(session.getAccessToken()).userId, 7);
});

test("expire() clears the retailer session, flags it, and ignores a stale generation", () => {
  const { storage, session } = makeSession({ [STAFF_ACCESS]: "staff-a" });
  session.save({ accessToken: retailerToken(7), refreshToken: "r1" });
  const generation = session.getGeneration();

  assert.equal(session.expire(generation - 1), false, "a stale expiry must not log the current account out");
  assert.ok(session.getAccessToken());

  assert.equal(session.expire(generation), true);
  const snapshot = session.getSnapshot();
  assert.equal(snapshot.accessToken, null);
  assert.equal(snapshot.expired, true);
  assert.equal(deriveRetailerState(snapshot, undefined).status, "expired");
  assert.equal(storage.data.get(STAFF_ACCESS), "staff-a");

  session.save({ accessToken: retailerToken(7), refreshToken: "r3" });
  assert.equal(session.getSnapshot().expired, false, "signing in again clears the expired flag");
});

test("blocked storage keeps the in-memory session and still notifies", () => {
  const { storage, session } = makeSession();
  storage.failWrites = true;
  storage.failReads = true;
  storage.failRemoves = true;
  let notified = 0;
  session.subscribe(() => notified++);

  session.save({ accessToken: retailerToken(7), refreshToken: "r1" });
  assert.equal(parseRetailerIdentity(session.getAccessToken()).userId, 7);
  assert.equal(notified, 1);

  session.clear();
  assert.equal(session.getAccessToken(), null);
  assert.equal(notified, 2);
});

test("no storage at all (server render) is a quiet anonymous session", () => {
  const session = createRetailerSession({ getStorage: () => null, eventTarget: null });
  assert.equal(session.getAccessToken(), null);
  session.save({ accessToken: retailerToken(7), refreshToken: "r1" });
  assert.ok(session.getAccessToken(), "memory still carries the session");
});

test("snapshots are referentially stable until something changes", () => {
  const { session } = makeSession();
  const first = session.getSnapshot();
  assert.equal(session.getSnapshot(), first);
  session.save({ accessToken: retailerToken(7), refreshToken: "r1" });
  const second = session.getSnapshot();
  assert.notEqual(second, first);
  assert.equal(session.getSnapshot(), second);
});

test("subscribe returns an unsubscribe", () => {
  const { session } = makeSession();
  let calls = 0;
  const off = session.subscribe(() => calls++);
  session.save({ accessToken: retailerToken(7), refreshToken: "r1" });
  off();
  session.clear();
  assert.equal(calls, 1);
});

test("another tab: a different account or a logout bumps the generation; a staff key does not", () => {
  const { storage, session, events } = makeSession();
  session.save({ accessToken: retailerToken(7), refreshToken: "r1" });
  const generation = session.getGeneration();
  let notified = 0;
  session.subscribe(() => notified++);

  events.emit({ key: STAFF_ACCESS });
  assert.equal(session.getGeneration(), generation);
  assert.equal(notified, 0);

  storage.data.set(RETAILER_ACCESS_KEY, retailerToken(8));
  storage.data.set(RETAILER_REFRESH_KEY, "other-r");
  events.emit({ key: RETAILER_ACCESS_KEY });
  assert.ok(session.getGeneration() > generation);
  assert.equal(parseRetailerIdentity(session.getAccessToken()).userId, 8);
  assert.equal(notified, 1);

  const afterSwitch = session.getGeneration();
  storage.data.delete(RETAILER_ACCESS_KEY);
  storage.data.delete(RETAILER_REFRESH_KEY);
  events.emit({ key: RETAILER_ACCESS_KEY });
  assert.ok(session.getGeneration() > afterSwitch);
  assert.equal(session.getAccessToken(), null);
});

test("another tab refreshing the same account is not an identity change", () => {
  const { storage, session, events } = makeSession();
  session.save({ accessToken: retailerToken(7), refreshToken: "r1" });
  const generation = session.getGeneration();

  const rotated = retailerToken(7, { exp: 4102444800 });
  storage.data.set(RETAILER_ACCESS_KEY, rotated);
  storage.data.set(RETAILER_REFRESH_KEY, "r2");
  events.emit({ key: RETAILER_ACCESS_KEY });

  assert.equal(session.getGeneration(), generation);
  assert.equal(session.getAccessToken(), rotated);
  assert.equal(session.getRefreshToken(), "r2");
});

test("parseRetailerIdentity reads user_id/role/tv and refuses non-retailer or malformed tokens", () => {
  assert.deepEqual(parseRetailerIdentity(retailerToken(12, { tv: 3, exp: 2000000000 })), {
    userId: 12,
    role: "RETAILER",
    tokenVersion: 3,
    exp: 2000000000
  });
  assert.equal(parseRetailerIdentity(staffToken()), null, "a staff role is not a retailer identity");
  assert.equal(parseRetailerIdentity(jwt({ role: "RETAILER" })), null, "no user id");
  assert.equal(parseRetailerIdentity("not-a-jwt"), null);
  assert.equal(parseRetailerIdentity(null), null);
  assert.equal(parseRetailerIdentity(undefined), null);
});

test("isRetailerTokenExpired uses exp with a skew and treats a missing exp as live", () => {
  const nowMs = Date.parse("2026-10-02T00:00:00Z");
  const exp = (offsetSeconds) => Math.floor(nowMs / 1000) + offsetSeconds;
  assert.equal(isRetailerTokenExpired(retailerToken(1, { exp: exp(-5) }), 30, nowMs), true);
  assert.equal(isRetailerTokenExpired(retailerToken(1, { exp: exp(10) }), 30, nowMs), true, "inside the skew");
  assert.equal(isRetailerTokenExpired(retailerToken(1, { exp: exp(3600) }), 30, nowMs), false);
  assert.equal(isRetailerTokenExpired(retailerToken(1), 30, nowMs), false);
  assert.equal(isRetailerTokenExpired("garbage", 30, nowMs), false);
});

test("readiness comes from the server's /store/me, never from the JWT role", () => {
  const { session } = makeSession();
  session.save({ accessToken: retailerToken(7), refreshToken: "r1" });
  const snapshot = session.getSnapshot();
  const generation = snapshot.generation;

  assert.equal(deriveRetailerState(undefined, undefined).status, "loading", "before storage is observed");

  const noMe = deriveRetailerState(snapshot, undefined);
  assert.equal(noMe.status, "authed");
  assert.equal(noMe.readiness, "loading");
  assert.equal(noMe.canPurchase, false, "a retailer JWT alone must not enable purchase");

  const confirm = deriveRetailerState(snapshot, {
    generation,
    me: { onboarding: "confirm", shop: null, addresses: [] }
  });
  assert.equal(confirm.readiness, "confirm");
  assert.equal(confirm.canPurchase, false);

  const ready = deriveRetailerState(snapshot, {
    generation,
    me: { onboarding: "ready", shop: { retailer_id: 41, name: "Test Shop" }, addresses: [] }
  });
  assert.equal(ready.readiness, "ready");
  assert.equal(ready.retailerId, 41);
  assert.equal(ready.canPurchase, true);

  const readyWithoutShop = deriveRetailerState(snapshot, { generation, me: { onboarding: "ready", shop: null } });
  assert.equal(readyWithoutShop.canPurchase, false, "ready without a shop id cannot buy");

  const failed = deriveRetailerState(snapshot, { generation, error: new Error("boom") });
  assert.equal(failed.readiness, "error");
  assert.equal(failed.canPurchase, false);

  const unknown = deriveRetailerState(snapshot, { generation, me: { onboarding: "something-new" } });
  assert.equal(unknown.readiness, "error");
});

test("a /store/me result from a previous account is never exposed after a switch", () => {
  const { session } = makeSession();
  session.save({ accessToken: retailerToken(7), refreshToken: "a" });
  const oldRecord = {
    generation: session.getGeneration(),
    me: { onboarding: "ready", shop: { retailer_id: 41 }, addresses: [{ id: 1 }] }
  };
  session.save({ accessToken: retailerToken(8), refreshToken: "b" });

  const state = deriveRetailerState(session.getSnapshot(), oldRecord);
  assert.equal(state.me, null);
  assert.equal(state.readiness, "loading");
  assert.equal(state.canPurchase, false);
  assert.equal(state.retailerId, null);
});

test("a stored token with a non-retailer role is anonymous and flagged for removal", () => {
  const { session } = makeSession();
  session.save({ accessToken: staffToken(), refreshToken: "x" });
  const state = deriveRetailerState(session.getSnapshot(), undefined);
  assert.equal(state.status, "anonymous");
  assert.equal(state.invalidCredentials, true);
  assert.equal(state.canPurchase, false);
});

test("logged out and expired states are distinct but both anonymous for browsing", () => {
  const { session } = makeSession();
  assert.equal(deriveRetailerState(session.getSnapshot(), undefined).status, "anonymous");
  session.save({ accessToken: retailerToken(7), refreshToken: "r" });
  session.expire(session.getGeneration());
  const expired = deriveRetailerState(session.getSnapshot(), undefined);
  assert.equal(expired.status, "expired");
  assert.equal(expired.readiness, "anonymous");
  assert.equal(expired.canPurchase, false);
});

test("validateRetailerIntent keeps one internal destination and refuses external ones", () => {
  assert.deepEqual(validateRetailerIntent({ type: "navigate", href: "/orders" }), { type: "navigate", href: "/orders" });
  assert.deepEqual(validateRetailerIntent({ type: "navigate", href: "/products?q=chips#top" }), {
    type: "navigate",
    href: "/products?q=chips#top"
  });
  for (const href of [
    "https://evil.example/orders",
    "//evil.example/orders",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "orders",
    "/ok\nHeader: x",
    "",
    null,
    42
  ]) {
    assert.equal(validateRetailerIntent({ type: "navigate", href }), null, `should refuse ${JSON.stringify(href)}`);
  }
});

test("validateRetailerIntent accepts a whole-packet SKU add and refuses anything else", () => {
  assert.deepEqual(validateRetailerIntent({ type: "add", skuId: 12 }), { type: "add", skuId: 12, quantity: 1 });
  assert.deepEqual(validateRetailerIntent({ type: "add", skuId: 12, quantity: 3 }), { type: "add", skuId: 12, quantity: 3 });
  for (const bad of [
    { type: "add", skuId: 0 },
    { type: "add", skuId: -4 },
    { type: "add", skuId: 1.5 },
    { type: "add", skuId: "12" },
    { type: "add", skuId: 5, quantity: 0 },
    { type: "add", skuId: 5, quantity: 2.5 },
    { type: "add", skuId: 5, quantity: 1000 },
    { type: "delete-account" },
    null,
    "navigate"
  ]) {
    assert.equal(validateRetailerIntent(bad), null, `should refuse ${JSON.stringify(bad)}`);
  }
});

test("validateRetailerIntent keeps a return to the cart, and decideResume holds it until the shop is ready", async () => {
  const { decideResume } = await import("../lib/store/session.mjs");
  assert.deepEqual(validateRetailerIntent({ type: "cart", extra: "dropped" }), { type: "cart" });
  assert.deepEqual(decideResume({ type: "cart" }, "new"), { action: "hold", reason: "onboarding" });
  assert.deepEqual(decideResume(null, "new"), { action: "none" });
});
