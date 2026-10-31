// Firebase phone proof for the storefront (D-03/D-04). Firebase only proves that the visitor owns a
// phone number; the proof is exchanged immediately for an Ascend retailer session and then
// discarded. Nothing here stores anything: auth persistence is in memory, the confirmation lives
// in this module, and signOutPhoneProof() ends the Firebase session after the exchange.
//
// The SDK is imported on first use, so a storefront visitor who never logs in never downloads it.
// Only the four browser-visible NEXT_PUBLIC_FIREBASE_* values are read. The server-side service
// account never reaches the browser bundle.

const REQUIRED_CONFIG = ["apiKey", "authDomain", "projectId", "appId"];

// Static property accesses: Next inlines NEXT_PUBLIC_* only when it can see the full name.
export function readPublicConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  };
}

async function loadFirebaseSdk() {
  const [app, auth] = await Promise.all([import("firebase/app"), import("firebase/auth")]);
  return { ...app, ...auth };
}

// Errors this module raises itself carry an `app/` code, in the same shape as Firebase's `auth/`.
//   app/not-configured  the public config is incomplete
//   app/busy            a code request or confirmation is already running
//   app/no-challenge    no code has been requested (or it was already used or disposed)
//   app/cancelled       the dialog was dismissed or the number changed while this was running
function appError(code) {
  return Object.assign(new Error(code), { code });
}

/**
 * deps.loadSdk: () => Promise<{ initializeApp, getApps, getApp, initializeAuth, getAuth,
 *   inMemoryPersistence, RecaptchaVerifier, signInWithPhoneNumber, signOut }>
 * deps.getConfig: () => { apiKey, authDomain, projectId, appId }
 */
export function createPhoneAuth(deps = {}) {
  const loadSdk = deps.loadSdk || loadFirebaseSdk;
  const getConfig = deps.getConfig || readPublicConfig;

  let ready = null; // Promise<{ sdk, auth }>, created once
  let entry = null; // the live verifier and the element it renders into
  let confirmation = null; // the pending ConfirmationResult
  // Bumped by every send and every disposal. Work started under an older value is stale: its
  // result is discarded instead of reviving a challenge the visitor already dismissed.
  let epoch = 0;
  let sendingEpoch = null;
  let confirming = false;

  function status() {
    const config = getConfig();
    return Object.fromEntries(REQUIRED_CONFIG.map((key) => [key, Boolean(config[key])]));
  }

  function init() {
    const config = getConfig();
    if (!REQUIRED_CONFIG.every((key) => config[key])) throw appError("app/not-configured");
    if (!ready) {
      ready = (async () => {
        const sdk = await loadSdk();
        const app = sdk.getApps().length ? sdk.getApp() : sdk.initializeApp(config);
        let auth;
        try {
          auth = sdk.initializeAuth(app, { persistence: sdk.inMemoryPersistence });
        } catch (error) {
          // Fast Refresh re-runs this module with the SDK already initialised.
          if (error?.code !== "auth/already-initialized") throw error;
          auth = sdk.getAuth(app);
        }
        return { sdk, auth };
      })().catch((error) => {
        ready = null;
        throw error;
      });
    }
    return ready;
  }

  // RecaptchaVerifier.clear() throws if called twice, so each verifier is cleared exactly once.
  function release(target) {
    if (!target || target.released) return;
    target.released = true;
    try {
      target.verifier.clear();
    } catch {
      // Already torn down by the SDK; nothing left to release.
    }
    target.host.remove();
    if (entry === target) entry = null;
  }

  function teardown() {
    release(entry);
    confirmation = null;
  }

  async function getFirebaseAuth() {
    return (await init()).auth;
  }

  /** Start loading the SDK while the visitor is still typing, so Send does not wait for it. */
  function warmPhoneAuth() {
    try {
      init().catch(() => {});
    } catch {
      // Not configured: sendPhoneCode reports it when the visitor actually asks for a code.
    }
  }

  /** Request an SMS code for an E.164 number. container: the element the invisible reCAPTCHA renders into. */
  async function sendPhoneCode(phoneE164, container) {
    if (sendingEpoch !== null && sendingEpoch === epoch) throw appError("app/busy");
    teardown();
    const mine = ++epoch;
    sendingEpoch = mine;
    let target = null;
    try {
      const { sdk, auth } = await init();
      if (epoch !== mine) throw appError("app/cancelled");
      const host = container.ownerDocument.createElement("div");
      container.appendChild(host);
      target = { verifier: new sdk.RecaptchaVerifier(auth, host, { size: "invisible" }), host, released: false };
      entry = target;
      const result = await sdk.signInWithPhoneNumber(auth, phoneE164, target.verifier);
      if (epoch !== mine) throw appError("app/cancelled");
      confirmation = result;
    } catch (error) {
      release(target);
      throw error;
    } finally {
      if (sendingEpoch === mine) sendingEpoch = null;
    }
  }

  /** Check the code the visitor typed and return a fresh Firebase ID token. The code stays a string. */
  async function confirmPhoneCode(code) {
    const pending = confirmation;
    if (!pending) throw appError("app/no-challenge");
    if (confirming) throw appError("app/busy");
    confirming = true;
    const mine = epoch;
    try {
      const credential = await pending.confirm(code);
      if (epoch !== mine) {
        await signOutPhoneProof();
        throw appError("app/cancelled");
      }
      const idToken = await credential.user.getIdToken();
      if (epoch !== mine) {
        await signOutPhoneProof();
        throw appError("app/cancelled");
      }
      // The challenge is used up. A wrong code never reaches here, so it can be retried.
      teardown();
      return idToken;
    } finally {
      confirming = false;
    }
  }

  /** Dismissal or a changed number: forget the challenge and ignore anything still in flight. */
  function disposePhoneVerifier() {
    epoch += 1;
    teardown();
  }

  /** End the Firebase phone-proof session once it has been exchanged (or the retailer logs out). */
  async function signOutPhoneProof() {
    if (!ready) return;
    try {
      const { sdk, auth } = await ready;
      await sdk.signOut(auth);
    } catch {
      // Best effort: the proof is in memory only and is gone on reload anyway.
    }
  }

  return {
    getFirebaseAuth,
    getFirebaseConfigStatus: status,
    warmPhoneAuth,
    sendPhoneCode,
    confirmPhoneCode,
    disposePhoneVerifier,
    signOutPhoneProof
  };
}

const defaultPhoneAuth = createPhoneAuth();

export const getFirebaseAuth = defaultPhoneAuth.getFirebaseAuth;
export const getFirebaseConfigStatus = defaultPhoneAuth.getFirebaseConfigStatus;
export const sendPhoneCode = defaultPhoneAuth.sendPhoneCode;
export const confirmPhoneCode = defaultPhoneAuth.confirmPhoneCode;
export const disposePhoneVerifier = defaultPhoneAuth.disposePhoneVerifier;
export const signOutPhoneProof = defaultPhoneAuth.signOutPhoneProof;
export const warmPhoneAuth = defaultPhoneAuth.warmPhoneAuth;
