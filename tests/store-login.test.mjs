// Behaviour tests for retailer phone login. node:test, no framework, no network:
//
//   node --test tests/store-login.test.mjs
//
// The Firebase adapter is exercised against an injected fake SDK, so nothing here loads the real
// SDK, reaches Google, sends a code or touches an API. The pure decisions (may this exchange be
// saved, where does a ready retailer go next) run on lib/store/session.mjs.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RESEND_COOLDOWN_SECONDS,
  canCommitExchange,
  canRequestCode,
  cooldownRemaining,
  decideResume,
  describeLoginError,
  exchangeAndSave,
  extendCooldown,
  isCompleteOtp,
  normalizeOtpInput,
  normalizePhoneInput,
  startCooldown
} from "../lib/store/session.mjs";
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

// ---------------------------------------------------------------------------------------------
// Phone and code input. The code is a string: "012345" must never become 12345.
// ---------------------------------------------------------------------------------------------

test("a 10-digit Indian mobile number is valid and gets +91", () => {
  assert.deepEqual(normalizePhoneInput("9876543210"), { digits: "9876543210", valid: true, e164: "+919876543210" });
});

test("pasted formats normalise: spaces, dashes, +91, 91 and a leading trunk zero", () => {
  for (const raw of ["98765 43210", "98765-43210", "+91 98765 43210", "+91-9876543210", "919876543210", "09876543210", " 9876543210 "]) {
    assert.equal(normalizePhoneInput(raw).e164, "+919876543210", raw);
  }
});

test("partial, over-long, empty and non-mobile numbers are invalid and keep what was typed", () => {
  for (const raw of ["98765", "98765432101", "", "abcdefghij", "1234567890", "5876543210"]) {
    const result = normalizePhoneInput(raw);
    assert.equal(result.valid, false, raw);
    assert.equal(result.e164, null, raw);
  }
  assert.equal(normalizePhoneInput("98765").digits, "98765");
});

test("a non-string phone input is invalid, not a crash", () => {
  for (const raw of [undefined, null, 9876543210, {}]) assert.equal(normalizePhoneInput(raw).valid, false);
});

test("the one-time code keeps its leading zero as a string", () => {
  assert.equal(normalizeOtpInput("012345"), "012345");
  assert.equal(normalizeOtpInput("000000"), "000000");
  assert.equal(typeof normalizeOtpInput("012345"), "string");
});

test("a pasted or autofilled code is cleaned and capped at six digits", () => {
  assert.equal(normalizeOtpInput("123 456"), "123456");
  assert.equal(normalizeOtpInput("123-456"), "123456");
  assert.equal(normalizeOtpInput("G-123456 is your code"), "123456");
  assert.equal(normalizeOtpInput("1234567890"), "123456");
  assert.equal(normalizeOtpInput("12ab"), "12");
  assert.equal(normalizeOtpInput(undefined), "");
});

test("only exactly six digits is a complete code", () => {
  assert.equal(isCompleteOtp("012345"), true);
  for (const code of ["12345", "1234567", "12345a", "", " 12345", undefined, 123456]) assert.equal(isCompleteOtp(code), false, String(code));
});

// ---------------------------------------------------------------------------------------------
// Resend cooldown.
// ---------------------------------------------------------------------------------------------

test("a code request starts a cooldown for that number only", () => {
  const cooldown = startCooldown("9876543210", 1_000_000);
  assert.equal(cooldown.phone, "9876543210");
  assert.equal(cooldown.until, 1_000_000 + RESEND_COOLDOWN_SECONDS * 1000);
});

test("the remaining wait counts down in whole seconds, rounding up, and never goes negative", () => {
  const cooldown = startCooldown("9876543210", 0);
  assert.equal(cooldownRemaining(cooldown, 0), RESEND_COOLDOWN_SECONDS);
  assert.equal(cooldownRemaining(cooldown, 100), RESEND_COOLDOWN_SECONDS);
  assert.equal(cooldownRemaining(cooldown, (RESEND_COOLDOWN_SECONDS - 1) * 1000 + 1), 1);
  assert.equal(cooldownRemaining(cooldown, RESEND_COOLDOWN_SECONDS * 1000), 0);
  assert.equal(cooldownRemaining(cooldown, 10 * RESEND_COOLDOWN_SECONDS * 1000), 0);
  assert.equal(cooldownRemaining(null, 0), 0);
});

test("resend is suppressed for the same number during the cooldown and allowed after it", () => {
  const cooldown = startCooldown("9876543210", 0);
  assert.deepEqual(canRequestCode(cooldown, "9876543210", 5_000), { allowed: false, remaining: RESEND_COOLDOWN_SECONDS - 5 });
  assert.deepEqual(canRequestCode(cooldown, "9876543210", RESEND_COOLDOWN_SECONDS * 1000), { allowed: true, remaining: 0 });
});

test("changing to a different number is not held back by the previous number's cooldown", () => {
  const cooldown = startCooldown("9876543210", 0);
  assert.deepEqual(canRequestCode(cooldown, "9123456780", 1_000), { allowed: true, remaining: 0 });
  assert.deepEqual(canRequestCode(null, "9123456780", 1_000), { allowed: true, remaining: 0 });
});

test("a 429 Retry-After lengthens the wait and never shortens it", () => {
  const cooldown = startCooldown("9876543210", 0);
  const longer = extendCooldown(cooldown, 2_000, 120);
  assert.equal(longer.until, 2_000 + 120_000);
  assert.equal(longer.phone, "9876543210");
  const shorter = extendCooldown(cooldown, 2_000, 5);
  assert.equal(shorter.until, cooldown.until, "a short Retry-After must not cut an existing wait");
});

test("a 429 with no readable Retry-After still imposes a wait, and an absurd one is capped", () => {
  const base = startCooldown("9876543210", 0);
  const missing = extendCooldown(base, 0, null);
  assert.ok(missing.until > base.until, "the unknown-length throttle waits longer than the normal cooldown");
  const absurd = extendCooldown(base, 0, 10 ** 9);
  assert.ok(absurd.until <= 3600 * 1000, "capped at an hour");
});

test("extending with no cooldown yet creates one for the given number", () => {
  const created = extendCooldown({ phone: "9876543210", until: 0 }, 1_000, 30);
  assert.equal(created.until, 31_000);
});

// ---------------------------------------------------------------------------------------------
// Error wording. Typed values are kept by the caller; this only decides what to say and where.
// ---------------------------------------------------------------------------------------------

const firebaseError = (code) => Object.assign(new Error(code), { code });
const storeError = (status, extra = {}) => Object.assign(new Error(`status ${status}`), { name: "StoreApiError", status, retryAfter: null, payload: null, reason: null, ...extra });

test("a wrong or expired code points at the code field with the contract copy", () => {
  for (const code of ["auth/invalid-verification-code", "auth/code-expired", "auth/missing-verification-code"]) {
    assert.deepEqual(describeLoginError(firebaseError(code)), {
      field: "code",
      message: "We couldn't verify that code. Check it or request a new code.",
      retryAfter: null
    });
  }
});

test("the backend refusing the proof (401) uses the same code copy", () => {
  const described = describeLoginError(storeError(401));
  assert.equal(described.field, "code");
  assert.equal(described.message, "We couldn't verify that code. Check it or request a new code.");
});

test("an invalid phone number points at the phone field", () => {
  for (const code of ["auth/invalid-phone-number", "auth/missing-phone-number"]) {
    assert.equal(describeLoginError(firebaseError(code)).field, "phone", code);
  }
});

test("throttling from Firebase or from Ascend asks the visitor to wait, carrying Retry-After", () => {
  for (const code of ["auth/too-many-requests", "auth/quota-exceeded"]) {
    const described = describeLoginError(firebaseError(code));
    assert.equal(described.field, "form");
    assert.match(described.message, /wait/i);
    assert.equal(described.retryAfter, null);
  }
  const ascend = describeLoginError(storeError(429, { retryAfter: 45 }));
  assert.equal(ascend.retryAfter, 45);
  assert.match(ascend.message, /wait/i);
});

test("provider or backend outages and a missing config read as temporarily unavailable", () => {
  for (const error of [firebaseError("app/not-configured"), firebaseError("auth/operation-not-allowed"), storeError(503), storeError(500)]) {
    const described = describeLoginError(error);
    assert.equal(described.field, "form");
    assert.match(described.message, /temporarily unavailable/i);
  }
});

test("a network failure asks for a connection check; an unknown failure is generic; none leak internals", () => {
  assert.match(describeLoginError(firebaseError("auth/network-request-failed")).message, /connection/i);
  assert.match(describeLoginError(storeError(0, { reason: "network" })).message, /connection/i);
  const unknown = describeLoginError(new Error("secret internal detail id_token=abc"));
  assert.equal(unknown.field, "form");
  assert.doesNotMatch(unknown.message, /secret|id_token|abc/);
  assert.equal(describeLoginError(null).field, "form");
});

test("a failed reCAPTCHA check says so without blaming the number", () => {
  const described = describeLoginError(firebaseError("auth/captcha-check-failed"));
  assert.equal(described.field, "form");
  assert.match(described.message, /try again/i);
});

// ---------------------------------------------------------------------------------------------
// Late completion. The exchange runs first; whether it may be saved is decided afterwards.
// ---------------------------------------------------------------------------------------------

function exchangeHarness({ open = true, generation = 5, attempt = 3, confirmError, exchangeError } = {}) {
  const state = { open, generation, attempt, saved: [], exchanged: [], confirmed: [] };
  const run = () =>
    exchangeAndSave({
      started: { attempt: 3, generation: 5 },
      confirm: async () => {
        state.confirmed.push(true);
        if (confirmError) throw confirmError;
        return "fresh-id-token";
      },
      exchange: async (idToken) => {
        state.exchanged.push(idToken);
        if (exchangeError) throw exchangeError;
        return { access_token: "access", refresh_token: "refresh", onboarding: "ready" };
      },
      current: () => ({ attempt: state.attempt, generation: state.generation, open: state.open }),
      save: (tokens) => state.saved.push(tokens)
    });
  return { state, run };
}

test("a current exchange saves the tokens once and reports the server's onboarding answer", async () => {
  const { state, run } = exchangeHarness();
  const result = await run();
  assert.deepEqual(result, { committed: true, onboarding: "ready" });
  assert.deepEqual(state.exchanged, ["fresh-id-token"]);
  assert.deepEqual(state.saved, [{ accessToken: "access", refreshToken: "refresh" }]);
});

test("closing the sheet while the exchange is in flight saves nothing", async () => {
  const { state, run } = exchangeHarness();
  const pending = run();
  state.open = false;
  assert.deepEqual(await pending, { committed: false, reason: "stale" });
  assert.deepEqual(state.saved, []);
});

test("an account switch while the exchange is in flight saves nothing", async () => {
  const { state, run } = exchangeHarness();
  const pending = run();
  state.generation = 6;
  assert.deepEqual(await pending, { committed: false, reason: "stale" });
  assert.deepEqual(state.saved, []);
});

test("changing the number while the exchange is in flight saves nothing", async () => {
  const { state, run } = exchangeHarness();
  const pending = run();
  state.attempt = 4;
  assert.deepEqual(await pending, { committed: false, reason: "stale" });
  assert.deepEqual(state.saved, []);
});

test("a wrong code never reaches the exchange; a refused exchange never saves", async () => {
  const wrong = exchangeHarness({ confirmError: firebaseError("auth/invalid-verification-code") });
  await assert.rejects(() => wrong.run(), { code: "auth/invalid-verification-code" });
  assert.deepEqual(wrong.state.exchanged, []);
  assert.deepEqual(wrong.state.saved, []);

  const refused = exchangeHarness({ exchangeError: storeError(401) });
  await assert.rejects(() => refused.run(), { status: 401 });
  assert.deepEqual(refused.state.saved, []);
});
