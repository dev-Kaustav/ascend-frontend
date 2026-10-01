"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useRetailer } from "@/components/store/RetailerProvider";
import { isStaleStoreError, storeEndpoints, storeFetch } from "@/lib/store/api.mjs";
import {
  canCommitExchange,
  decideResume,
  getSessionGeneration,
  saveRetailerTokens
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
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(null); // "send" | "verify" | null
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState(null); // { field: "phone" | "code" | "form", message }
  const [notice, setNotice] = useState("");

  const dialogRef = useRef(null);
  const phoneRef = useRef(null);
  const codeRef = useRef(null);
  const recaptchaRef = useRef(null);
  const openRef = useRef(true);
  const attemptRef = useRef(0); // bumped by a number change or a restart; drops a late exchange
  const loginGenerationRef = useRef(null); // the session generation this sheet created
  const resumedRef = useRef(false);

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
      disposePhoneVerifier();
    };
  }, []);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  async function onSendCode(event) {
    event.preventDefault();
    if (busy) return;
    const digits = phone.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError({ field: "phone", message: "Enter a 10-digit mobile number." });
      return;
    }
    setError(null);
    setNotice("");
    setBusy("send");
    const attempt = attemptRef.current;
    try {
      await sendPhoneCode(`+91${digits}`, recaptchaRef.current);
      if (attempt !== attemptRef.current || !openRef.current) return;
      setStep("code");
      setCode("");
      setNotice("Code sent. Enter the 6 digits from the SMS.");
    } catch (failure) {
      if (failure?.code === "app/cancelled" || attempt !== attemptRef.current || !openRef.current) return;
      setError({
        field: "form",
        message:
          failure?.code === "auth/invalid-phone-number"
            ? "Enter a valid mobile number."
            : "We couldn't send a code. Please try again."
      });
    } finally {
      if (attempt === attemptRef.current) setBusy(null);
    }
  }

  async function onVerify(event) {
    event.preventDefault();
    if (busy) return;
    if (!/^\d{6}$/.test(code)) {
      setError({ field: "code", message: "Enter the 6-digit code." });
      return;
    }
    setError(null);
    setNotice("");
    setBusy("verify");
    const started = { attempt: attemptRef.current, generation: getSessionGeneration() };
    try {
      const idToken = await confirmPhoneCode(code);
      const data = await storeFetch(storeEndpoints.authExchange, {
        method: "POST",
        public: true,
        body: JSON.stringify({ id_token: idToken })
      });
      const current = { attempt: attemptRef.current, generation: getSessionGeneration(), open: openRef.current };
      if (!canCommitExchange(started, current)) return;
      saveRetailerTokens({ accessToken: data.access_token, refreshToken: data.refresh_token });
      loginGenerationRef.current = getSessionGeneration();
      signOutPhoneProof();
      setSignedIn(true);
      setNotice("Signed in. Loading your account.");
    } catch (failure) {
      if (failure?.code === "app/cancelled" || isStaleStoreError(failure)) return;
      if (started.attempt !== attemptRef.current || !openRef.current) return;
      setError({
        field: failure?.code === "auth/invalid-verification-code" || failure?.code === "auth/code-expired" ? "code" : "form",
        message:
          failure?.code === "auth/invalid-verification-code" || failure?.code === "auth/code-expired"
            ? "We couldn't verify that code. Check it or request a new code."
            : "We couldn't sign you in. Please try again."
      });
    } finally {
      if (started.attempt === attemptRef.current) setBusy(null);
    }
  }

  function onChangeNumber() {
    attemptRef.current += 1;
    disposePhoneVerifier();
    setStep("phone");
    setCode("");
    setError(null);
    setNotice("");
    setBusy(null);
    requestAnimationFrame(() => phoneRef.current?.focus());
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

  if (!host) return null;

  return createPortal(
    <div className="store-sheet-backdrop" data-firebase-missing={missingConfig} data-login-status={status}>
      <div
        ref={dialogRef}
        className="store-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="store-login-title"
      >
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
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  aria-invalid={error?.field === "phone" ? "true" : undefined}
                  aria-describedby={error?.field === "phone" ? "store-login-error" : undefined}
                  disabled={busy === "send"}
                />
              </div>
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
                onChange={(event) => setCode(event.target.value)}
                aria-invalid={error?.field === "code" ? "true" : undefined}
                aria-describedby={error?.field === "code" ? "store-login-error" : undefined}
                disabled={pending}
              />
              <button type="submit" className="store-button store-sheet__submit" disabled={pending}>
                {busy === "verify" || signedIn ? "Verifying" : "Verify code"}
              </button>
              <button type="button" className="store-link-button" onClick={onChangeNumber} disabled={signedIn}>
                Change number
              </button>
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
