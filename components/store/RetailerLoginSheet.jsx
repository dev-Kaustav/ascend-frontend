"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useRetailer } from "@/components/store/RetailerProvider";
import { isStaleStoreError, storeEndpoints, storeFetch } from "@/lib/store/api.mjs";
import {
  canRequestCode,
  decideResume,
  describeLoginError,
  exchangeAndSave,
  extendCooldown,
  getSessionGeneration,
  isCompleteOtp,
  normalizeOtpInput,
  normalizePhoneInput,
  saveRetailerTokens,
  startCooldown
} from "@/lib/store/session.mjs";
import {
  confirmPhoneCode,
  disposePhoneVerifier,
  getFirebaseConfigStatus,
  sendPhoneCode,
  signOutPhoneProof
} from "@/lib/store/firebase";

// Retailer login: phone number, six-digit code, then the one exchange of Firebase's proof for an
// Ascend retailer session. One dialog: a centred modal up to 440px on desktop, a bottom sheet on a
// phone. Sheets never stack, so this replaces whichever sheet was open.

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

// The sheet owns one history entry so the browser Back button closes it before leaving the page
// underneath. Module-level because React Strict Mode mounts, unmounts and re-mounts in one tick,
// and that must not push (or pop) a second entry.
const historyEntry = { live: 0, open: false };

function acquireHistoryEntry() {
  historyEntry.live += 1;
  if (!historyEntry.open) {
    window.history.pushState({ ascendSheet: "login" }, "");
    historyEntry.open = true;
  }
}

function releaseHistoryEntry() {
  historyEntry.live -= 1;
  // Deferred, so a Strict Mode re-mount (live back to 1) keeps the entry. The popstate listener
  // is already gone by the time this pop lands, so it cannot be mistaken for the Back button.
  setTimeout(() => {
    if (historyEntry.live === 0 && historyEntry.open) {
      historyEntry.open = false;
      window.history.back();
    }
  }, 0);
}

// "+91 98765 43210" for display; the number is only ever shown back to the person who typed it.
const formatPhone = (digits) => `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;

export default function RetailerLoginSheet({ intent, onClose }) {
  const router = useRouter();
  const { readiness, status, takeIntent, openSheet, closeSheet, refreshMe } = useRetailer();

  // Created here, attached in an effect: a detached element is not a side effect, and the sheet is
  // only ever loaded in the browser (ssr: false).
  const [host] = useState(() => {
    if (typeof document === "undefined") return null;
    const element = document.createElement("div");
    element.className = "store-sheet-host";
    return element;
  });
  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState(""); // the 10 digits a code was last requested for
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(null); // "send" | "verify" | null
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState(null); // { field: "phone" | "code" | "form", message }
  const [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useState(null); // { phone, until }: resend wait for one number
  const [verifyUntil, setVerifyUntil] = useState(null); // epoch ms: verify waits out a 429
  const [now, setNow] = useState(() => Date.now());

  const dialogRef = useRef(null);
  const phoneRef = useRef(null);
  const codeRef = useRef(null);
  const recaptchaRef = useRef(null);
  const openRef = useRef(true);
  const attemptRef = useRef(0); // bumped by a number change or a restart; drops a late exchange
  const proofRef = useRef(null); // a confirmed ID token kept only to retry a transient exchange failure
  const loginGenerationRef = useRef(null); // the session generation this sheet created
  const resumedRef = useRef(false);

  const resendWait = canRequestCode(cooldown, sentTo, now).remaining;
  const verifyWait = verifyUntil ? Math.max(0, Math.ceil((verifyUntil - now) / 1000)) : 0;
  const ticking = resendWait > 0 || verifyWait > 0;

  useEffect(() => {
    if (!ticking) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ticking]);

  // The host lives inside .ascend-storefront so the sheet inherits the storefront styles, while
  // everything else in that root can be made inert behind it. Declared first so it runs before the
  // effects below, which need the host in the document.
  useEffect(() => {
    if (!host) return undefined;
    const root = document.querySelector(".ascend-storefront") || document.body;
    root.appendChild(host);
    return () => {
      host.remove();
    };
  }, [host]);

  useEffect(() => {
    if (!host) return undefined;
    const trigger = document.activeElement;
    const root = host.parentElement;
    const inerted = [];
    for (const child of root.children) {
      if (child !== host && !child.inert) {
        child.inert = true;
        inerted.push(child);
      }
    }
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    acquireHistoryEntry();
    phoneRef.current?.focus();

    return () => {
      for (const child of inerted) child.inert = false;
      document.documentElement.style.overflow = previousOverflow;
      releaseHistoryEntry();
      if (trigger && trigger.isConnected && typeof trigger.focus === "function") trigger.focus();
    };
  }, [host]);

  // What the visitor dismissed they no longer want: the held destination is dropped with the sheet.
  const dismiss = useCallback(() => {
    if (!openRef.current) return;
    openRef.current = false;
    attemptRef.current += 1;
    proofRef.current = null;
    disposePhoneVerifier();
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!host) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const items = [...dialogRef.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!dialogRef.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    function onPopState() {
      // The browser already removed our entry.
      historyEntry.open = false;
      dismiss();
    }
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("popstate", onPopState);
    };
  }, [host, dismiss]);

  // Unmounting for any reason ends the challenge. Nothing Firebase-side outlives the dialog.
  useEffect(() => {
    openRef.current = true; // Strict Mode re-runs this after its simulated unmount
    return () => {
      openRef.current = false;
      attemptRef.current += 1;
      proofRef.current = null;
      disposePhoneVerifier();
    };
  }, []);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  // Ask Firebase to text a code. Used for the first request and for Resend.
  async function requestCode(digits) {
    setError(null);
    setNotice("");
    setBusy("send");
    proofRef.current = null;
    const attempt = attemptRef.current;
    try {
      await sendPhoneCode(`+91${digits}`, recaptchaRef.current);
      if (attempt !== attemptRef.current || !openRef.current) return;
      const at = Date.now();
      setSentTo(digits);
      setCooldown(startCooldown(digits, at));
      setNow(at);
      setVerifyUntil(null);
      setCode("");
      setStep("code");
      setNotice("Code sent. Enter the 6 digits from the SMS.");
    } catch (failure) {
      if (failure?.code === "app/cancelled" || attempt !== attemptRef.current || !openRef.current) return;
      const described = describeLoginError(failure);
      // A throttle from Firebase carries no Retry-After, so the unknown-length wait applies.
      if (failure?.code === "auth/too-many-requests" || failure?.code === "auth/quota-exceeded") {
        const at = Date.now();
        setSentTo(digits);
        setCooldown(extendCooldown(startCooldown(digits, at), at, null));
        setNow(at);
      }
      setError({ field: described.field, message: described.message });
    } finally {
      if (attempt === attemptRef.current) setBusy(null);
    }
  }

  function onSendCode(event) {
    event.preventDefault();
    if (busy) return;
    const normalized = normalizePhoneInput(phone);
    if (!normalized.valid) {
      setError({ field: "phone", message: "Enter a valid 10-digit mobile number." });
      return;
    }
    const gate = canRequestCode(cooldown, normalized.digits, Date.now());
    if (!gate.allowed) {
      setError({ field: "form", message: `Please wait ${gate.remaining}s before requesting another code.` });
      return;
    }
    requestCode(normalized.digits);
  }

  function onResend() {
    if (busy || canRequestCode(cooldown, sentTo, Date.now()).remaining > 0) return;
    requestCode(sentTo);
  }

  async function onVerify(event) {
    event.preventDefault();
    if (busy || verifyWait > 0) return;
    if (!proofRef.current && !isCompleteOtp(code)) {
      setError({ field: "code", message: "Enter the 6-digit code." });
      return;
    }
    setError(null);
    setNotice("");
    setBusy("verify");
    const started = { attempt: attemptRef.current, generation: getSessionGeneration() };
    try {
      const result = await exchangeAndSave({
        started,
        // A proof kept from a transient failure is reused, so a throttled or offline moment does not
        // cost the visitor another SMS. A fresh code check otherwise.
        confirm: async () => {
          if (!proofRef.current) proofRef.current = await confirmPhoneCode(code);
          return proofRef.current;
        },
        exchange: (idToken) =>
          storeFetch(storeEndpoints.authExchange, { method: "POST", public: true, body: JSON.stringify({ id_token: idToken }) }),
        current: () => ({ attempt: attemptRef.current, generation: getSessionGeneration(), open: openRef.current }),
        save: saveRetailerTokens
      });
      proofRef.current = null;
      if (!result.committed) return;
      loginGenerationRef.current = getSessionGeneration();
      signOutPhoneProof();
      setSignedIn(true);
      setNotice("Signed in. Loading your account.");
    } catch (failure) {
      if (failure?.code === "app/cancelled" || isStaleStoreError(failure)) return;
      if (started.attempt !== attemptRef.current || !openRef.current) return;
      const described = describeLoginError(failure);
      // Only a transient failure keeps the proof: a 401 or a bad code means a new code is needed.
      const transient = failure?.reason === "network" || failure?.status === 429 || failure?.status >= 500;
      if (!transient) proofRef.current = null;
      if (failure?.status === 429) {
        const at = Date.now();
        // Resend is held for at least as long as the backend asked; Verify waits exactly that long.
        setCooldown(extendCooldown(cooldown || startCooldown(sentTo, at), at, described.retryAfter));
        setVerifyUntil(extendCooldown({ phone: sentTo, until: 0 }, at, described.retryAfter).until);
        setNow(at);
      }
      setError({ field: described.field, message: described.message });
    } finally {
      if (started.attempt === attemptRef.current) setBusy(null);
    }
  }

  function onChangeNumber() {
    attemptRef.current += 1;
    proofRef.current = null;
    disposePhoneVerifier();
    setStep("phone");
    setCode("");
    setSentTo("");
    setVerifyUntil(null);
    setError(null);
    setNotice("");
    setBusy(null);
    requestAnimationFrame(() => phoneRef.current?.focus());
  }

  function onCodeChange(value) {
    // Editing the code abandons any proof kept for a retry: it belonged to the old code.
    proofRef.current = null;
    setCode(normalizeOtpInput(value));
  }

  // After a successful exchange the provider loads /store/me; once readiness is a final answer the
  // held destination is resumed, exactly once, and only for the session this sheet created.
  useEffect(() => {
    if (!signedIn || resumedRef.current) return;
    if (loginGenerationRef.current !== getSessionGeneration()) return;
    const decision = decideResume(intent, readiness);
    if (decision.action === "wait") return;
    resumedRef.current = true;
    openRef.current = false;
    if (decision.action === "navigate") {
      takeIntent();
      // The sheet's history entry is replaced by the destination, so Back returns to the page the
      // visitor came from instead of to an empty sheet entry.
      historyEntry.open = false;
      router.replace(decision.href);
      closeSheet();
    } else if (decision.reason === "onboarding") {
      openSheet("shop");
    } else {
      closeSheet();
    }
  }, [signedIn, readiness, intent, takeIntent, closeSheet, openSheet, router]);

  const sessionFailed = signedIn && readiness === "error";
  // Names only, never values: lets an operator see which public setting a build is missing.
  const missingConfig = Object.entries(getFirebaseConfigStatus())
    .filter(([, present]) => !present)
    .map(([name]) => name)
    .join(",");
  const pending = busy !== null || (signedIn && !sessionFailed);
  const describedBy = (field, hintId) =>
    [hintId, error?.field === field ? "store-login-error" : null].filter(Boolean).join(" ") || undefined;

  if (!host) return null;

  return createPortal(
    <div className="store-sheet-backdrop" data-firebase-missing={missingConfig} data-login-status={status}>
      <div ref={dialogRef} className="store-sheet" role="dialog" aria-modal="true" aria-labelledby="store-login-title">
        <div className="store-sheet__head">
          <h2 id="store-login-title">Log in or Sign up</h2>
          <button type="button" className="store-sheet__close" onClick={dismiss} aria-label="Close login">
            <X size={22} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        <div className="store-sheet__body">
          {step === "phone" ? (
            <form onSubmit={onSendCode} noValidate>
              <label className="store-label" htmlFor="store-login-phone">
                Mobile number
              </label>
              <div className="store-field">
                <span className="store-field__prefix" aria-hidden="true">
                  +91
                </span>
                <input
                  ref={phoneRef}
                  id="store-login-phone"
                  className="store-input"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  maxLength={20}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  aria-invalid={error?.field === "phone" ? "true" : undefined}
                  aria-describedby={describedBy("phone", "store-login-phone-hint")}
                  disabled={busy === "send"}
                />
              </div>
              <p id="store-login-phone-hint" className="store-hint">
                We&apos;ll text you a 6-digit code.
              </p>
              <button
                type="submit"
                className="store-button store-sheet__submit"
                aria-label="Continue and send login code"
                disabled={pending}
              >
                {busy === "send" ? "Sending code" : "Continue"}
              </button>
            </form>
          ) : (
            <form onSubmit={onVerify} noValidate>
              <label className="store-label" htmlFor="store-login-code">
                6-digit code
              </label>
              <input
                ref={codeRef}
                id="store-login-code"
                className="store-input store-input--code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => onCodeChange(event.target.value)}
                onPaste={(event) => {
                  const text = event.clipboardData?.getData("text");
                  if (typeof text === "string") {
                    // A pasted "123 456" is longer than maxLength, so clean it before the browser truncates it.
                    event.preventDefault();
                    onCodeChange(text);
                  }
                }}
                aria-invalid={error?.field === "code" ? "true" : undefined}
                aria-describedby={describedBy("code", "store-login-code-hint")}
                disabled={pending}
              />
              <p id="store-login-code-hint" className="store-hint">
                Sent to {formatPhone(sentTo)}.
              </p>
              <button type="submit" className="store-button store-sheet__submit" disabled={pending || verifyWait > 0}>
                {busy === "verify" || signedIn ? "Verifying" : verifyWait > 0 ? `Try again in ${verifyWait}s` : "Verify code"}
              </button>
              <div className="store-sheet__links">
                <button type="button" className="store-link-button" onClick={onResend} disabled={pending || resendWait > 0}>
                  {resendWait > 0 ? `Resend code in ${resendWait}s` : "Resend code"}
                </button>
                <button type="button" className="store-link-button" onClick={onChangeNumber} disabled={signedIn}>
                  Change number
                </button>
              </div>
            </form>
          )}

          {error ? (
            <p id="store-login-error" className="store-form-error" role="alert">
              {error.message}
            </p>
          ) : null}
          {sessionFailed ? (
            <div className="store-form-error" role="alert">
              <p>We couldn&apos;t finish signing you in.</p>
              <button type="button" className="store-link-button" onClick={refreshMe}>
                Try again
              </button>
            </div>
          ) : null}
          <p className="store-sheet__live" role="status" aria-live="polite">
            {notice}
          </p>
          <div ref={recaptchaRef} />
        </div>
      </div>
    </div>,
    host
  );
}
