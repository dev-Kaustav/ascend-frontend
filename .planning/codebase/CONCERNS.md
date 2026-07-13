# Codebase Concerns

**Analysis Date:** 2026-07-13

## Tech Debt

**Monolithic Component Files:**
- Issue: Several components exceed 1,600 lines of code, combining state management, UI rendering, and API logic in single files
- Files: 
  - `components/workspaces/UsersAdminPanel.jsx` (1,676 lines)
  - `components/workspaces/BillLabelsPanel.jsx` (1,628 lines)
  - `components/admin/QuickCreatePanel.jsx` (1,208 lines)
- Impact: Difficult to maintain, test, and reason about. Risk of unintended side effects when modifying logic. High cognitive load for new developers.
- Fix approach: Extract state management into custom hooks, separate concerns (form handling, data fetching, rendering), create smaller sub-components. Start with `UsersAdminPanel.jsx` - extract permission logic, group management, and access rules into separate modules.

**Excessive useState in Single Component:**
- Issue: `UsersAdminPanel.jsx` has 44+ useState declarations (lines 19-58), making state management fragile and error-prone
- Files: `components/workspaces/UsersAdminPanel.jsx`
- Impact: State mutations not properly coordinated. Hard to track state flow. Easy to create inconsistent states across related values.
- Fix approach: Consolidate related state into objects or use `useReducer` for complex state transitions (user changes, group changes, access rules changes).

**Missing Test Coverage:**
- Issue: Zero test files found in entire codebase. No `.test.js`, `.spec.js`, or test directory.
- Files: Project-wide
- Impact: No regression detection. Refactoring is risky. API contract changes will go undetected until production.
- Fix approach: Start with integration tests for critical paths (auth flow, order creation, user management). Use Jest/React Testing Library. Priority: `lib/auth.js`, `lib/api.js`, payment flows.

**Insufficient Error Handling:**
- Issue: Many API calls lack try-catch blocks or error boundaries. Silent failures possible in several places.
- Files:
  - `lib/api.js` (lines 57-71, 88-105): Error handling exists but no retry logic for transient failures
  - `app/demo/_lib/client.js` (lines 24-41): Throws AgentError but parent components may not catch it
  - Multiple components fetch data without error UI (e.g., `components/orders/AdminOrderCreate.jsx`)
- Impact: User sees no feedback on failed operations. Network glitches cause silent data loss. Support burden increases.
- Fix approach: Implement retry logic with exponential backoff in `apiFetch` for 5xx errors. Add error boundaries at page level. Create consistent error toast notifications.

**Regex Pattern Complexity in Bill Labels:**
- Issue: Bill parsing logic in `BillLabelsPanel.jsx` (lines 83-150) uses 30+ complex regex patterns for extracting bill data from OCR text
- Files: `components/workspaces/BillLabelsPanel.jsx` (lines 83-150)
- Impact: Fragile parsing. Pattern collisions possible. Hard to debug when extraction fails on real bills. No validation that extracted data is correct.
- Fix approach: Add unit tests for bill parsing with sample OCR outputs. Document each pattern with why it exists. Consider fallback to manual entry for unparseable bills.

**Hardcoded String Literals Scattered:**
- Issue: Role names, permission codes, email domains, API endpoints scattered as hardcoded strings
- Files:
  - `components/workspaces/UsersAdminPanel.jsx` (line 18: `emailDomain = "ascendfoods.in"`, line 62: role array)
  - `lib/auth.js` (lines 1-2: token key constants, line 73: hardcoded role check)
  - Multiple components: role checks like `role === "DRIVER"`, `role === "ADMIN"`
- Impact: Difficult to update domain or role names. Risk of typos. Inconsistencies across files.
- Fix approach: Create constants file `lib/constants.js` with `ROLES`, `PERMISSIONS`, `EMAIL_DOMAIN`, `API_KEYS`. Import everywhere.

**Global API Cache with Memory Leaks:**
- Issue: `lib/api.js` uses module-level Maps (`apiCache`, `apiInflight`) that grow unbounded (lines 4-5)
- Files: `lib/api.js`
- Impact: Long-running apps accumulate stale cache entries. Memory usage grows over time. No TTL cleanup mechanism.
- Fix approach: Implement cache eviction by adding periodic cleanup (every 5 mins) or use WeakMap for browser-based expiry. Or switch to a proper cache library (e.g., `lru-cache`).

**Token Parsing Without Validation:**
- Issue: `parseJwt` in `lib/auth.js` (lines 46-55) decodes JWT but does not validate signature or expiration
- Files: `lib/auth.js` (lines 46-55)
- Impact: Malformed or expired tokens will not be detected until server rejects them. User could act with stale permissions.
- Fix approach: Add expiration check. Call `/auth/me` endpoint to validate token on app load. Log out if token invalid.

**Magic Numbers in BillLabels:**
- Issue: Page dimensions, canvas sizes, and processing constants appear as bare numbers (lines 6-17 of `BillLabelsPanel.jsx`)
- Files: `components/workspaces/BillLabelsPanel.jsx` (lines 6-18)
- Impact: Hard to maintain. Risk of incorrect values if copied elsewhere. No justification for chosen sizes.
- Fix approach: Move to top-level constants with documentation. Example: `LABEL_WIDTH_IN: 3 // inches, matches 3x2.25 receipt label stock`.

**Session Storage for Authentication:**
- Issue: Access tokens stored in `sessionStorage`, which clears on tab close. No refresh token rotation logic.
- Files: `lib/auth.js` (lines 16, 19, 26, 34, 42, 43)
- Impact: User logged out if browser tab closes. No way to refresh token server-side. Session fixation possible if XSS vulnerability exists.
- Fix approach: Consider `localStorage` for persistent login (with secure flag). Implement refresh token rotation on server. Add CSRF protection for state-changing operations.

## Known Bugs

**Timezone Offset Bug in Order Creation:**
- Symptoms: Order date shown incorrect in some timezones. `getTodayDate()` uses client timezone but may mismatch server timezone.
- Files: `components/orders/AdminOrderCreate.jsx` (lines 19-23)
- Trigger: Create order in timezone UTC+5:30 (India) or other non-UTC timezone. Check date on server.
- Workaround: Server-side validation corrects date, but UI shows wrong value before submission.
- Fix approach: Always use server date via API endpoint `/admin/today` or send UTC timestamp and let server parse.

**Undefined Behavior in Permission Merging:**
- Symptoms: Permission state inconsistency when user/group permissions overlap
- Files: `components/workspaces/UsersAdminPanel.jsx` (lines 72-91, 97-110)
- Trigger: Apply same permission to user and group simultaneously. User gets permission from both sources.
- Workaround: Refresh page to reload state.
- Fix approach: Clarify whether group permissions override or merge with user permissions. Add test case.

**Bill Number Masking Fallback:**
- Symptoms: Bill numbers show as "XXXX" when missing
- Files: `components/workspaces/BillLabelsPanel.jsx` (line 292)
- Trigger: OCR fails to extract bill number. UI shows "XXXX" instead of prompting user to enter manually.
- Workaround: User can manually edit and save.
- Fix approach: Show empty field with validation error, not masked text. Prompt user to enter missing data.

**Modal/Dialog Focus Trap Missing:**
- Symptoms: Keyboard users can tab out of modal dialogs
- Files: Multiple modal components (e.g., `components/workspaces/UsersAdminPanel.jsx` modal sections)
- Trigger: Open modal, press Tab repeatedly.
- Workaround: Use mouse to close modal.
- Fix approach: Wrap modals with focus trap. Test with keyboard navigation.

## Security Considerations

**Token Exposure in Memory:**
- Risk: Access token stored in memory object `memoryTokens` (line 4 in `lib/auth.js`). Vulnerable to XSS (attacker reads window.memoryTokens).
- Files: `lib/auth.js` (lines 4-7)
- Current mitigation: Token in `sessionStorage` (cleared on tab close). No XSS protections documented.
- Recommendations: 
  - Use HttpOnly cookies for tokens (requires backend support)
  - Implement Content Security Policy (CSP) to block inline scripts
  - Add XSS filtering on all user inputs
  - Never log tokens to console

**No CSRF Protection on State-Changing Operations:**
- Risk: POST/PUT requests to create orders, users, permissions lack CSRF tokens
- Files: All API calls in `lib/api.js`, components using `apiFetch` for mutations
- Current mitigation: Cookies marked with `credentials: "include"` (line 50, `lib/api.js`) but no double-submit or token validation
- Recommendations:
  - Add CSRF token to request headers (standard practice in Next.js)
  - Validate token on server before processing mutations
  - Use SameSite=Strict on auth cookies

**No Input Validation Before API Send:**
- Risk: User input accepted as-is and sent to API. SQL injection, NoSQL injection possible if API doesn't validate.
- Files: `components/orders/AdminOrderCreate.jsx`, `components/admin/QuickCreatePanel.jsx`, `components/workspaces/UsersAdminPanel.jsx`
- Current mitigation: Minimal validation (e.g., email format, phone length) but no sanitization
- Recommendations:
  - Use `zod` (already in `package.json`) for schema validation before API calls
  - Sanitize text inputs (remove control characters)
  - Validate GST numbers, phone numbers with regex before send
  - Example: Create `lib/validation.js` with reusable validators

**API Error Responses Logged to UI:**
- Risk: Server error details exposed to end user, including file paths, DB errors
- Files: `lib/api.js` (line 61, 96), any component showing error from `error.payload`
- Current mitigation: Error message formatted but not filtered
- Recommendations:
  - Never show raw server errors to users
  - Map server errors to generic messages ("Something went wrong, try again")
  - Log detailed errors to server-side logging (Sentry, DataDog)

**No Rate Limiting on Frontend:**
- Risk: User can rapidly fire requests (order creation, user creation) causing DoS on backend
- Files: All mutation operations in components
- Current mitigation: UI buttons may be disabled during save (`saving`, `setSaving` flags) but no request deduplication
- Recommendations:
  - Debounce repeated clicks on submit buttons
  - Track in-flight requests and reject duplicates
  - Add request timeout (fetch AbortController)

## Performance Bottlenecks

**Large Component Re-renders:**
- Problem: `UsersAdminPanel.jsx` and `BillLabelsPanel.jsx` rerender entire component on any state change (44+ useState mutations)
- Files: `components/workspaces/UsersAdminPanel.jsx`, `components/workspaces/BillLabelsPanel.jsx`
- Cause: No memoization (`React.memo`, `useMemo`), no key optimization in lists
- Improvement path: 
  - Split into smaller memoized subcomponents
  - Use `useMemo` for derived state (e.g., sorted lists, filtered items)
  - Use `useCallback` for event handlers
  - Measure with React DevTools Profiler before/after

**PDF Generation Blocking UI:**
- Problem: `BillLabelsPanel.jsx` processes and renders multiple PDF labels synchronously in browser, may freeze UI on large batches
- Files: `components/workspaces/BillLabelsPanel.jsx` (label rendering loops, PDF generation logic)
- Cause: No web worker offloading, no pagination for large datasets
- Improvement path:
  - Move PDF generation to web worker
  - Batch process labels (e.g., 10 at a time)
  - Show progress bar during generation
  - Implement virtual scrolling for large label lists

**API Cache Not Keyed by Query Parameters:**
- Problem: `apiFetchCached` caches entire URL but doesn't differentiate by filter params
- Files: `lib/api.js` (lines 114-139)
- Cause: Cache key is URL string only. Two calls with different query params share same cache.
- Improvement path:
  - Parse URL and sort query params before caching
  - Add cache key builder function
  - Test with `/orders?status=confirmed` vs `/orders?status=pending`

**N+1 API Calls in Order Creation:**
- Problem: `AdminOrderCreate.jsx` calls `useAdminLookups` which fetches retailers, skus, warehouses, salesmen, brands in parallel, but may refetch on every component mount
- Files: `components/orders/AdminOrderCreate.jsx` (lines 33-45), `lib/hooks/useAdminLookups` (exact location unclear)
- Cause: No dependency array or refetch guard in hook
- Improvement path:
  - Check hook implementation
  - Ensure lookups cached and only refetched explicitly
  - Use `React.memo` on lookup components

**Tesseract.js OCR Running in Main Thread:**
- Problem: Bill label OCR (using Tesseract.js) runs in main JavaScript thread, may block UI during image processing
- Files: `components/workspaces/BillLabelsPanel.jsx` (Tesseract usage unclear without full file read)
- Cause: No web worker integration
- Improvement path:
  - Move Tesseract to web worker
  - Add progress callback to show extraction status
  - Allow user to cancel long-running OCR

## Fragile Areas

**User Permission System:**
- Files: `components/workspaces/UsersAdminPanel.jsx`, `lib/accessRules.js`
- Why fragile: Permission logic split across component state and server API. Multiple sources of truth (user permissions, group permissions, access rules). No clear reconciliation strategy.
- Safe modification: 
  - Add comprehensive test suite for permission merge logic (lines 72-110)
  - Document expected behavior: Do group perms override user perms? Or merge?
  - Extract into separate service: `lib/permissions.js` with unit tests
  - Test changes: Load user, add to group with new perms, verify result
- Test coverage: No tests. Critical gap.

**Bill Parsing from OCR Text:**
- Files: `components/workspaces/BillLabelsPanel.jsx` (lines 83-150, regex patterns)
- Why fragile: Parsing depends on OCR output format, which varies by provider, image quality, language. Regex patterns fragile to whitespace/punctuation changes.
- Safe modification:
  - Add sample OCR outputs from real bills to test suite
  - Create test case for each regex pattern with expected input/output
  - Add fallback to manual entry if parsing confidence below threshold
  - Test changes with actual bill images before deploy
- Test coverage: No tests. High risk for regression.

**Access Rules Matching:**
- Files: `lib/accessRules.js` (lines 3-12, pattern matching logic)
- Why fragile: Pattern matching uses regex with special chars (`:`, `*`). Escaping logic complex and easy to break (line 6-8).
- Safe modification:
  - Add test cases for each pattern type: exact match, prefix match, wildcard, dynamic segments (`:id`)
  - Test edge cases: double slashes, trailing slash, empty pattern
  - Test changes: Load 100 access rules and verify correct rule matched for various paths
- Test coverage: No tests. Potential for unauthorized access if pattern matching breaks.

**Demo Mode Simulation vs Live Mode:**
- Files: `app/demo/_lib/client.js`, `app/demo/_lib/simulation.js`
- Why fragile: Demo and live modes must return identical response contracts, but they're implemented separately. Contract drift possible.
- Safe modification:
  - Keep contracts in `app/demo/_lib/contracts.js` (export types/schemas)
  - Both simulation and live mode must validate against contract before return
  - Add integration test that compares demo output with live output for same input
  - Test changes: Run workflow in both modes, compare recommendation/basket/retailer objects
- Test coverage: No tests. Easy to break demo when updating live API.

## Scaling Limits

**In-Memory API Cache:**
- Current capacity: Unbounded (grows with each unique URL requested)
- Limit: After ~10,000 requests, browser memory usage increases noticeably (depends on response size)
- Scaling path: 
  - Implement TTL-based eviction (current code has TTL check but no cleanup)
  - Add size limit (max 50MB of cached data)
  - Switchto IndexedDB for larger datasets
  - Monitor with browser DevTools: Performance tab > Memory

**User Admin Panel State:**
- Current capacity: Can load ~100 users without lag (estimated from 1,676-line component)
- Limit: >500 users causes noticeable slowdown. 1000+ users may freeze UI for seconds.
- Scaling path:
  - Implement virtual scrolling (only render visible rows)
  - Add pagination (50 users per page)
  - Move to server-side search/filter
  - Add loading indicator so user knows it's working
  - Monitor: React DevTools Profiler > "Ranked chart" for slow components

**Bill Labels List:**
- Current capacity: ~100 bills can be rendered and printed without lag
- Limit: 1000+ bills causes PDF generation to timeout or crash browser tab
- Scaling path:
  - Implement batch processing (generate 10 PDFs, pause, continue)
  - Add file streaming (download as you generate, not all at once in memory)
  - Split large requests into multiple API calls
  - Move PDF generation to backend service

**Concurrent API Requests:**
- Current capacity: 4 concurrent fetch calls (based on other APIs)
- Limit: >20 requests in flight may cause connection pool exhaustion
- Scaling path:
  - Implement request queue (max 10 in flight, queue rest)
  - Use AbortController to cancel stale requests
  - Monitor network tab: DevTools > Network

## Dependencies at Risk

**pdfjs-dist (^5.6.205):**
- Risk: Large library (2.5MB uncompressed). May cause bundle bloat. Security advisories possible.
- Impact: Page load time affected. PDF rendering may have bugs.
- Migration plan: Consider `pdf-lib` (already present) for simple use cases. If full pdfjs needed, lazy-load with dynamic import.

**tesseract.js (^7.0.0):**
- Risk: Large library (varies by language pack). Runs in main thread, blocks UI. Complex dependencies.
- Impact: Bill label extraction slow. UI freezes during OCR.
- Migration plan: Consider hosted OCR API (Google Vision, AWS Textract) for better performance and accuracy. Or move OCR to backend service.

**recharts (^2.12.7):**
- Risk: Chart library adds significant bundle size. Limited customization.
- Impact: Dashboard slow on low-end devices.
- Migration plan: If dashboards are core, acceptable. Otherwise, consider lightweight alternative (e.g., Chart.js, Visx).

**React 18.3.1:**
- Risk: Current version. Next version (19+) may have breaking changes.
- Impact: App must update React when Next.js requires it.
- Migration plan: Monitor Next.js changelog. Plan React upgrade every 12 months. Test thoroughly after upgrade.

**Next.js 16.1.6:**
- Risk: Breaking changes in minor versions possible (though rare). Current version may have security bugs.
- Impact: App may not support latest features or security patches.
- Migration plan: Update quarterly. Run full test suite after upgrade. Monitor Next.js security advisories.

## Missing Critical Features

**No Offline Support:**
- Problem: App requires live API connection. No cached UI, no queued operations.
- Blocks: User cannot work during network outage. Changes lost if connection drops.
- Impact: Affects sales team, warehouse workers in areas with poor connectivity.

**No User Audit Log:**
- Problem: No tracking of who created/modified orders, users, permissions.
- Blocks: Cannot investigate data integrity issues. Compliance gaps for regulated data.
- Impact: Support cannot diagnose data issues. Regulatory audits fail.

**No Notification System:**
- Problem: User changes (password reset, role change) not communicated. Order status changes not pushed.
- Blocks: Users miss critical updates. Manual polling required.
- Impact: Orders may be missed. Security issues not communicated.

**No Export Functionality (Except PDF Labels):**
- Problem: Reports cannot be exported to CSV/Excel. Users stuck in UI.
- Blocks: Cannot share data with stakeholders in office/email format.
- Impact: Workaround: copy-paste from UI, error-prone.

**No Soft Delete / Undo:**
- Problem: Deleting users, orders is permanent. No recovery option.
- Blocks: Accidental deletions cannot be recovered.
- Impact: Data loss risk. Users hesitant to clean up old data.

## Test Coverage Gaps

**Authentication Flow:**
- What's not tested: Login, logout, token refresh, expired token handling, role-based access
- Files: `lib/auth.js`, `app/login/page.js`, various protected routes
- Risk: Login might silently fail. Unauthorized users might gain access. Session hijacking possible.
- Priority: High

**API Fetch Error Handling:**
- What's not tested: Network errors, 401/403/500 responses, error message formatting, retry logic
- Files: `lib/api.js`
- Risk: Silent failures. Users unaware of failed operations. Support burden.
- Priority: High

**Bill Parsing Regex:**
- What's not tested: OCR output parsing, extraction accuracy, edge cases (missing fields, malformed input)
- Files: `components/workspaces/BillLabelsPanel.jsx` (lines 83-150)
- Risk: Parsing fails on real bills in production. No early warning.
- Priority: High

**Permission Logic:**
- What's not tested: Permission merge, group vs user permissions, access rule matching
- Files: `components/workspaces/UsersAdminPanel.jsx`, `lib/accessRules.js`
- Risk: Unauthorized access or overly restrictive permissions. Security issue.
- Priority: High

**Order Creation Validation:**
- What's not tested: Invalid order data accepted. Payment logic, discount calculation, tax rounding
- Files: `components/orders/AdminOrderCreate.jsx`, `lib/orders.js`
- Risk: Financial data corruption. Reconciliation failures. Regulatory issues.
- Priority: High

**Responsive Design / Mobile:**
- What's not tested: UI behavior on mobile, tablet. Touch interactions, small screens.
- Files: All components
- Risk: App unusable on mobile. Drivers in field cannot use outlet-finder.
- Priority: Medium (depends on device support requirement)

---

*Concerns audit: 2026-07-13*
