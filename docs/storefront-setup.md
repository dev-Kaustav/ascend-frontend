# Storefront setup: retailer phone login

This page lists the names, checks and evidence for the storefront's phone-OTP login (Phase 9, plan
09-04). It contains no credentials and must stay that way. Values go in `ascend-frontend/.env`
(git-ignored) and in the server's own environment; they are never pasted into this file, a ticket
or a chat.

## How login works

1. The visitor enters a +91 mobile number in the store's own sheet (Orders and Account open it for a
   signed-out visitor; `/login` stays the staff screen).
2. The browser asks Firebase Authentication to text a six-digit code (invisible reCAPTCHA).
3. The visitor enters the code. Firebase returns an ID token proving they own the number.
4. The browser sends that ID token once to `POST /auth/retailer/firebase`. The backend verifies it,
   takes the phone number from the token (never from the request body) and returns Ascend's own
   retailer tokens.
5. Firebase's session is ended straight away (`signOut`). Only the Ascend retailer session remains,
   stored under `ascend_store_access_token` / `ascend_store_refresh_token`. Staff keys are separate
   and untouched.

Firebase persistence is in memory only; nothing Firebase-side is written to browser storage.

## Browser-visible settings (names only)

Set these in `ascend-frontend/.env` and rebuild (`NEXT_PUBLIC_*` values are inlined at build time):

| Name | Where it comes from |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Console, project settings, the project's web app config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | same web app config |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | same web app config |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | same web app config |
| `NEXT_PUBLIC_API_BASE_URL` | the Ascend API origin the browser calls (for example `https://api.ascendfoods.in`) |

These four Firebase values are public by design (they identify the project to the browser). The
server-side service account is a different thing and must never be given a `NEXT_PUBLIC_` name or
reach the frontend.

### Checking presence without reading values

Open the login sheet in a build and look at the dialog's backdrop element: it carries
`data-firebase-missing`, a comma-separated list of the config keys the build did not receive
(`apiKey`, `authDomain`, `projectId`, `appId`). Empty means all four were present at build time.
Only key names are exposed, never values. If a key is listed, the sheet answers "Login is
temporarily unavailable" and sends nothing.

## Backend checks (presence and match, no values)

- `FIREBASE_SERVICE_ACCOUNT_JSON` must be set in the backend's environment (a minified service
  account JSON, in the server's `.env`). Check that it is present; never print or share it.
  Without it `/auth/retailer/firebase` answers 503 "Login is temporarily unavailable."
- The service account must belong to the **same Firebase project** as the four browser values
  above. A mismatch makes every real token fail verification (401).
- The API must allow the storefront's origin in CORS (`https://ascendfoods.in` in production, plus
  the local origin when testing locally).
- The backend accepts only +91 numbers and refuses a sign-in older than 300 seconds
  (`OTP_TOKEN_MAX_AGE_SECONDS`).

## Firebase Console checks (to be done by the project owner)

- Authentication, Sign-in method: **Phone** provider enabled.
- Authentication, Settings, SMS region policy: **India (+91)** allowed.
- Authentication, Settings, Authorized domains: the HTTPS storefront host (`ascendfoods.in`) and
  `localhost` for local testing.
- Optional but recommended for testing: add a Firebase **test phone number** with a fixed code
  (Authentication, Sign-in method, Phone numbers for testing). A test number sends no SMS and so
  costs nothing and reaches nobody.

## Approved package evidence

| Item | Value |
|---|---|
| Package | `firebase` pinned **exactly** to `12.17.1` (`package.json`: `"firebase": "12.17.1"`, no range) |
| Registry | `https://registry.npmjs.org/` (the lockfile resolves `node_modules/firebase` to `https://registry.npmjs.org/firebase/-/firebase-12.17.1.tgz`) |
| Source repository | `github.com/firebase/firebase-js-sdk` (official) |
| Published | 2026-08-04 (latest at the time of the audit was 12.19.0, published 2026-09-09) |
| npm maintainers | four accounts, including `firebase-ops` and `google-wombot` (the Firebase team's publishing accounts) |
| Install hooks on `firebase` itself | none (no preinstall, install, postinstall or prepare) |
| Registry signatures | verified for all 547 installed packages (`npm audit signatures`) |
| Audit tool verdict | **SUS** for the package (the tool audits only the latest release, 12.19.0, flagged "too new"). Not cleared by the tool. The **project owner approved this exact pin** after reviewing the evidence above |
| Other dependencies changed | none (the install added 75 packages and changed no existing version) |

Transitive packages added with install scripts, reviewed by reading the published code:

| Package | Script | What it does |
|---|---|---|
| `@firebase/util@1.15.2` | `postinstall: node ./postinstall.js` (official firebase-js-sdk, published by the Firebase team) | Reads the optional `FIREBASE_WEBAPP_CONFIG` environment variable; **only if it is set** it may call `firebase.googleapis.com` for web config, then writes `dist/postinstall.js(.mjs)` inside the package. Unset (the case here) it writes an empty default and does nothing else |
| `protobufjs@7.6.6` | `postinstall: node scripts/postinstall` | Prints a warning if a dependent uses a different version-scheme prefix. No network, no file writes |

`npm audit` also lists advisories against `@grpc/grpc-js` under `@firebase/firestore`. Those are
server-side gRPC behaviours in a package the storefront does not import (it uses
`firebase/app` and `firebase/auth` only). npm's suggested "fix" is a downgrade to firebase 9.14.0,
which is not appropriate; the advisories are left as known and unexploitable here, and should be
revisited when the pin is next reviewed.

The SDK is loaded lazily, only when the login sheet opens, so public browsing does not download it.

## Evidence status

Labels: **OBSERVED** (seen working, against mocks where stated), **PENDING** (not done; needs a real
provider setup, a device or a human), **UNVERIFIED** (reported, not confirmed).

| Claim | Status | Notes |
|---|---|---|
| Phone sheet, code step, exchange, resume to the held destination | OBSERVED against fakes | Headless Chrome against a production build. Real Firebase SDK ran; every Google/Firebase request was intercepted and answered by a local fake (including a stand-in reCAPTCHA script) and anything unrecognised was blocked; the backend was a throwaway mock. No SMS was sent, no real Firebase project was contacted, and the production-copy database and production API were never used |
| Leading-zero code kept as a string; paste and autofill cleaned; resend cooldown; 429 Retry-After wait; late completion after close or account switch saves nothing | OBSERVED against fakes, and covered by `tests/store-login.test.mjs` | |
| `NEXT_PUBLIC_FIREBASE_*` present in the real `.env` | **UNVERIFIED** | The project owner reported adding all four. A build run on 2026-10-02 saw none of the four (all listed in `data-firebase-missing`). Not investigated further because `.env` is not read. Check the exact names and that the file is `ascend-frontend/.env`, then rebuild |
| Phone provider, India SMS policy, authorized domains, backend/browser project match, CORS origin | **PENDING** | Not confirmed by anyone yet |
| A Firebase test phone number exists | **PENDING** | Not confirmed |
| A real invisible reCAPTCHA check, a real SMS and a real ID token accepted by the real backend | **PENDING** | Mocks do not prove these |
| Android Chrome (about 360px) and iOS Safari (about 390px): software keyboard open on the phone and code screens, SMS code autofill, reCAPTCHA behaviour, Back through the sheet, safe-area spacing | **PENDING** (end-of-phase human check) | Resized desktop windows are not device evidence |

## Required device evidence (end of phase)

Record on a real Android phone (Chrome) and a real iPhone (Safari), in the browser, without
installing anything:

1. Open the store, tap Orders or Account while signed out: the Log in or Sign up sheet opens, the
   page behind does not move.
2. Phone number field opens the telephone keypad; code field opens the numeric keypad and, on iOS
   and Android, offers the SMS code for autofill. Neither input zooms the page on focus.
3. With the keyboard open the whole sheet can still be scrolled to Continue / Verify code.
4. The invisible reCAPTCHA completes (or its challenge appears and can be solved) and a code arrives.
5. A correct code lands on the originally chosen page; the browser Back button then returns to where
   the visit started and does not reopen the sheet.
6. A wrong code keeps the typed code and the sheet; Resend waits, then works.
