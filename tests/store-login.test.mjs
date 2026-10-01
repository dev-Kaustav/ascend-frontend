// Behaviour tests for retailer phone login. node:test, no framework, no network:
//
//   node --test tests/store-login.test.mjs
//
// The Firebase adapter is exercised against an injected fake SDK, so nothing here loads the real
// SDK, reaches Google, sends a code or touches an API. The pure decisions (may this exchange be
// saved, where does a ready retailer go next) run on lib/store/session.mjs.
import assert from "node:assert/strict";
import { test } from "node:test";
import { canCommitExchange, decideResume } from "../lib/store/session.mjs";
import { createPhoneAuth } from "../lib/store/firebase.js";

// ---------------------------------------------------------------------------------------------
// Exchange commit gate: a result may be saved only if the sheet is still open on the same attempt
// and no identity change happened while the exchange was in flight (T-09-04-1).
// ---------------------------------------------------------------------------------------------

const started = { attempt: 3, generation: 5 };

test("an exchange that is still current may be saved", () => {
  assert.equal(canCommitExchange(started, { attempt: 3, generation: 5, open: true }), true);
});

test("closing the sheet before the exchange ends prevents the credential save", () => {
  assert.equal(canCommitExchange(started, { attempt: 3, generation: 5, open: false }), false);
});

test("changing the number or restarting bumps the attempt and drops the late result", () => {
  assert.equal(canCommitExchange(started, { attempt: 4, generation: 5, open: true }), false);
});

test("an identity change while the exchange runs drops the late result", () => {
  assert.equal(canCommitExchange(started, { attempt: 3, generation: 6, open: true }), false);
});

test("missing state is never treated as current", () => {
  assert.equal(canCommitExchange(null, { attempt: 3, generation: 5, open: true }), false);
  assert.equal(canCommitExchange(started, null), false);
  assert.equal(canCommitExchange({ attempt: 3 }, { attempt: 3, generation: 5, open: true }), false);
});

// ---------------------------------------------------------------------------------------------
// Resume: only a ready retailer is sent on; unfinished onboarding keeps the intent for 09-06.
// ---------------------------------------------------------------------------------------------

test("a ready retailer resumes a validated internal destination", () => {
  assert.deepEqual(decideResume({ type: "navigate", href: "/orders?page=2" }, "ready"), {
    action: "navigate",
    href: "/orders?page=2"
  });
});

test("a ready retailer with no intent has nothing to resume", () => {
  assert.deepEqual(decideResume(null, "ready"), { action: "none" });
});

test("new and confirm retailers keep the intent until onboarding finishes", () => {
  const intent = { type: "navigate", href: "/account" };
  assert.deepEqual(decideResume(intent, "new"), { action: "hold", reason: "onboarding" });
  assert.deepEqual(decideResume(intent, "confirm"), { action: "hold", reason: "onboarding" });
});

test("a product add stays pending for the cart slice instead of being dropped", () => {
  assert.deepEqual(decideResume({ type: "add", skuId: 12, quantity: 2 }, "ready"), { action: "hold", reason: "add" });
});

test("an external, protocol-relative or unknown destination is never followed", () => {
  for (const href of ["https://evil.example/orders", "//evil.example", "/\\evil.example", "javascript:alert(1)", ""]) {
    assert.deepEqual(decideResume({ type: "navigate", href }, "ready"), { action: "none" }, href);
  }
  assert.deepEqual(decideResume({ type: "teleport" }, "ready"), { action: "none" });
});

test("readiness that is not a final answer resumes nothing", () => {
  for (const readiness of ["loading", "error", "anonymous", undefined]) {
    assert.deepEqual(decideResume({ type: "navigate", href: "/orders" }, readiness), { action: "wait" }, String(readiness));
  }
});

// ---------------------------------------------------------------------------------------------
// Firebase adapter against a fake SDK.
// ---------------------------------------------------------------------------------------------

const CONFIG = { apiKey: "test-key", authDomain: "test.example", projectId: "test-project", appId: "1:2:web:3" };

function fakeSdk({ sendDelay = null, confirmError = null, sendError = null } = {}) {
  const log = [];
  const verifiers = [];
  let signedOut = 0;
  const auth = { name: "auth", signOut: async () => (signedOut += 1) };
  let loads = 0;
  class RecaptchaVerifier {
    constructor(a, container, params) {
      this.cleared = false;
      this.container = container;
      this.params = params;
      assert.equal(a, auth);
      verifiers.push(this);
    }
    clear() {
      this.cleared = true;
    }
  }
  const sdk = {
    getApps: () => [],
    initializeApp: (config) => {
      log.push(["initializeApp", config]);
      return { config };
    },
    initializeAuth: (app, deps) => {
      log.push(["initializeAuth", deps.persistence]);
      return auth;
    },
    inMemoryPersistence: "in-memory",
    RecaptchaVerifier,
    signInWithPhoneNumber: (a, phone, verifier) => {
      log.push(["signInWithPhoneNumber", phone]);
      assert.equal(a, auth);
      const finish = () => {
        if (sendError) throw sendError;
        return {
          confirm: async (code) => {
            log.push(["confirm", code]);
            if (confirmError) throw confirmError;
            return { user: { getIdToken: async () => `id-token-for-${code}` } };
          }
        };
      };
      if (sendDelay) return sendDelay.then(finish);
      return Promise.resolve().then(finish);
    },
    signOut: async (a) => {
      assert.equal(a, auth);
      signedOut += 1;
    }
  };
  return {
    sdk,
    log,
    verifiers,
    get loads() {
      return loads;
    },
    loadSdk: async () => {
      loads += 1;
      return sdk;
    },
    get signedOut() {
      return signedOut;
    }
  };
}

function fakeContainer() {
  const children = [];
  return {
    children,
    ownerDocument: {
      createElement: () => {
        const el = { removed: false, remove() { this.removed = true; } };
        return el;
      }
    },
    appendChild(el) {
      children.push(el);
      return el;
    }
  };
}

function makeAuth(overrides = {}, sdkOptions = {}) {
  const fake = fakeSdk(sdkOptions);
  const phoneAuth = createPhoneAuth({ loadSdk: fake.loadSdk, getConfig: () => CONFIG, ...overrides });
  return { fake, phoneAuth };
}

test("sending a code initialises one in-memory auth and one invisible verifier", async () => {
  const { fake, phoneAuth } = makeAuth();
  const container = fakeContainer();
  await phoneAuth.sendPhoneCode("+919876543210", container);
  assert.deepEqual(
    fake.log.filter(([name]) => name !== "signInWithPhoneNumber").map(([name, arg]) => [name, arg]),
    [
      ["initializeApp", CONFIG],
      ["initializeAuth", "in-memory"]
    ]
  );
  assert.equal(fake.verifiers.length, 1);
  assert.equal(fake.verifiers[0].params.size, "invisible");
  assert.equal(container.children.length, 1);
  assert.ok(fake.log.some(([name, arg]) => name === "signInWithPhoneNumber" && arg === "+919876543210"));
});

test("a missing public config fails before the SDK is loaded or any request is made", async () => {
  const fake = fakeSdk();
  const phoneAuth = createPhoneAuth({ loadSdk: fake.loadSdk, getConfig: () => ({ ...CONFIG, apiKey: undefined }) });
  await assert.rejects(() => phoneAuth.sendPhoneCode("+919876543210", fakeContainer()), { code: "app/not-configured" });
  assert.equal(fake.loads, 0);
  assert.equal(fake.log.length, 0);
});

test("the config status reports presence only, never a value", () => {
  const { phoneAuth } = makeAuth({ getConfig: () => ({ ...CONFIG, authDomain: "" }) });
  assert.deepEqual(phoneAuth.getFirebaseConfigStatus(), { apiKey: true, authDomain: false, projectId: true, appId: true });
});

test("a second send disposes the first verifier and keeps exactly one", async () => {
  const { fake, phoneAuth } = makeAuth();
  const container = fakeContainer();
  await phoneAuth.sendPhoneCode("+919876543210", container);
  await phoneAuth.sendPhoneCode("+919876543210", container);
  assert.equal(fake.verifiers.length, 2);
  assert.equal(fake.verifiers[0].cleared, true);
  assert.equal(fake.verifiers[1].cleared, false);
  assert.equal(container.children[0].removed, true);
  assert.equal(container.children[1].removed, false);
});

test("a send already in flight refuses a second one rather than racing it", async () => {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  const { fake, phoneAuth } = makeAuth({}, { sendDelay: gate });
  const first = phoneAuth.sendPhoneCode("+919876543210", fakeContainer());
  await assert.rejects(() => phoneAuth.sendPhoneCode("+919876543210", fakeContainer()), { code: "app/busy" });
  release();
  await first;
  assert.equal(fake.verifiers.length, 1);
});

test("confirming returns a fresh ID token, consumes the confirmation and signs the proof out", async () => {
  const { fake, phoneAuth } = makeAuth();
  await phoneAuth.sendPhoneCode("+919876543210", fakeContainer());
  const token = await phoneAuth.confirmPhoneCode("012345");
  assert.equal(token, "id-token-for-012345", "the code is passed through as the string it was typed");
  await assert.rejects(() => phoneAuth.confirmPhoneCode("012345"), { code: "app/no-challenge" });
  await phoneAuth.signOutPhoneProof();
  assert.equal(fake.signedOut, 1);
});

test("a wrong code leaves the challenge in place so the same code screen can retry", async () => {
  const error = Object.assign(new Error("bad"), { code: "auth/invalid-verification-code" });
  const { phoneAuth } = makeAuth({}, { confirmError: error });
  await phoneAuth.sendPhoneCode("+919876543210", fakeContainer());
  await assert.rejects(() => phoneAuth.confirmPhoneCode("111111"), { code: "auth/invalid-verification-code" });
  await assert.rejects(() => phoneAuth.confirmPhoneCode("222222"), { code: "auth/invalid-verification-code" });
});

test("confirming with no code request pending is refused", async () => {
  const { phoneAuth } = makeAuth();
  await assert.rejects(() => phoneAuth.confirmPhoneCode("123456"), { code: "app/no-challenge" });
});

test("dismissal disposes the verifier and the confirmation", async () => {
  const { fake, phoneAuth } = makeAuth();
  const container = fakeContainer();
  await phoneAuth.sendPhoneCode("+919876543210", container);
  phoneAuth.disposePhoneVerifier();
  assert.equal(fake.verifiers[0].cleared, true);
  assert.equal(container.children[0].removed, true);
  await assert.rejects(() => phoneAuth.confirmPhoneCode("123456"), { code: "app/no-challenge" });
});

test("a send that completes after dismissal is discarded and its verifier cleared", async () => {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  const { fake, phoneAuth } = makeAuth({}, { sendDelay: gate });
  const sending = phoneAuth.sendPhoneCode("+919876543210", fakeContainer());
  await new Promise((resolve) => setImmediate(resolve));
  phoneAuth.disposePhoneVerifier();
  release();
  await assert.rejects(() => sending, { code: "app/cancelled" });
  assert.equal(fake.verifiers[0].cleared, true);
  await assert.rejects(() => phoneAuth.confirmPhoneCode("123456"), { code: "app/no-challenge" });
});

test("a failed send clears its verifier so the next attempt starts clean", async () => {
  const error = Object.assign(new Error("quota"), { code: "auth/too-many-requests" });
  const { fake, phoneAuth } = makeAuth({}, { sendError: error });
  await assert.rejects(() => phoneAuth.sendPhoneCode("+919876543210", fakeContainer()), { code: "auth/too-many-requests" });
  assert.equal(fake.verifiers[0].cleared, true);
});
