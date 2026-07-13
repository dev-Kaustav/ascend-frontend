<!-- refreshed: 2026-07-13 -->
# Architecture

**Analysis Date:** 2026-07-13

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                           Next.js App Router                                 │
│  Root Layout (`app/layout.js`) — Metadata, Fonts, Fonts, Organization Schema │
└────────────────────────────────────────────────────────────────────────────┬─┘
         │
         ├─────────────────────────────────────────────────────┬───────────────┐
         ▼                                                       ▼               ▼
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│  Public Pages        │  │  Auth Layer          │  │  Protected Routes    │
│  `app/page.js`       │  │  `app/login/page.js` │  │  `app/app/(protected)` │
│  Landing, Marketing  │  │  JWT Token Manager   │  │  Role-based Access   │
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘
                                │                              │
                                │                              ▼
                         ┌──────────────────────────────────────────────────┐
                         │         AccessLayout Component                   │
                         │  - Permission validation                          │
                         │  - Role-based routing                             │
                         │  - AppShell (nav, sidebar)                        │
                         └───────────┬────────────────────────────────────────┘
                                     │
                  ┌──────────────────┼──────────────────┬───────────────────┐
                  ▼                  ▼                  ▼                   ▼
            ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐
            │  Dashboard  │  │  Workspace   │  │   Orders    │  │ Outlet      │
            │  Pages      │  │   Pages      │  │   Pages     │  │ Finder      │
            │  (RDC)      │  │   (Finance,  │  │             │  │             │
            │             │  │    Ops, etc) │  │             │  │             │
            └─────────────┘  └──────────────┘  └──────────────┘  └─────────────┘
                  │                  │                  │                │
                  └─────────────────┬┴──────────────────┴────────────────┘
                                    ▼
                     ┌──────────────────────────────────────┐
                     │     Component Layer                  │
                     │  - Dashboard Components              │
                     │  - Workspace Panels                  │
                     │  - Layout Components                 │
                     │  - Shared UI Components              │
                     │  - Table/Chart Components            │
                     └──────────────────────────────────────┘
                                    │
                                    ▼
                     ┌──────────────────────────────────────┐
                     │     Utility Layer                    │
                     │  - `lib/api.js` — Fetch + caching    │
                     │  - `lib/auth.js` — Token management  │
                     │  - `lib/hooks/` — Reusable hooks    │
                     │  - `lib/navigation.js` — Nav routing  │
                     │  - `lib/format.js` — Formatting      │
                     └──────────────────────────────────────┘
                                    │
                                    ▼
                     ┌──────────────────────────────────────┐
                     │     External API Layer               │
                     │  - Backend API (FastAPI)             │
                     │  - OSRM (Route optimization)         │
                     │  - Tesseract.js (OCR)                │
                     │  - PDF generation (pdf-lib)          │
                     └──────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| RootLayout | Site metadata, fonts, schema setup | `app/layout.js` |
| LoginPage | User authentication, token management | `app/login/page.js` |
| AccessLayout | Role validation, permission checks, nav injection | `components/layout/AccessLayout.jsx` |
| AppShell | Top nav, sidebar, mobile menu, user info | `components/layout/AppShell.jsx` |
| DashboardPage | Role-based dashboard dispatch | `app/app/(protected)/dashboard/page.js` |
| Dashboard Components | Role-specific metric/chart views | `components/dashboard/*.jsx` |
| Workspace Pages | Tabbed interface for data management | `app/app/(protected)/[workspace]/page.js` |
| Workspace Panels | Tab-specific data views and forms | `components/workspaces/*.jsx` |
| API Module | HTTP requests with auth, caching, error handling | `lib/api.js` |
| Auth Module | Token storage, parsing, role extraction | `lib/auth.js` |

## Pattern Overview

**Overall:** Next.js SSR with client-side interactivity, role-based access control (RBAC), workspace-based information architecture.

**Key Characteristics:**
- Role-based routing enforced at layout level (AccessLayout)
- Token-based authentication (JWT stored in sessionStorage)
- API-driven data fetching with client-side caching (apiFetchCached)
- Workspace pattern for organizing complex features (Finance, Operations, Master Data)
- Reusable dashboard component dispatch based on user role
- Tabbed interface pattern for workspace features

## Layers

**Public Layer:**
- Purpose: Marketing, login, unauthenticated routes
- Location: `app/page.js`, `app/login/page.js`, `app/*/page.js` (non-protected)
- Contains: Landing components, login form
- Depends on: Next.js, auth utilities (token check)
- Used by: Unauthenticated users

**Authentication Layer:**
- Purpose: Token management, JWT parsing, role extraction
- Location: `lib/auth.js`
- Contains: Token storage (sessionStorage + memory), JWT parsing, role/user extraction
- Depends on: None
- Used by: All protected components, AccessLayout

**Access Control Layer:**
- Purpose: Permission validation, role-based routing, request interception
- Location: `components/layout/AccessLayout.jsx`, `lib/accessRules.js`, `lib/hooks/usePermissions.js`, `lib/hooks/useAccessRules.js`
- Contains: Permission checking, access rule evaluation, route guards
- Depends on: Auth, API
- Used by: Protected layout

**API Layer:**
- Purpose: HTTP communication, token injection, caching, error handling
- Location: `lib/api.js`
- Contains: `apiFetch`, `apiFetchBlob`, `apiFetchCached`, endpoint definitions
- Depends on: Auth
- Used by: All data-fetching components

**Dashboard Layer:**
- Purpose: Role-specific overview and summary views
- Location: `components/dashboard/*.jsx`
- Contains: Role dispatchers (AdminDashboard, BrandDashboard, RetailerDashboard, etc.)
- Depends on: API, formatting utilities
- Used by: DashboardPage

**Workspace Layer:**
- Purpose: Tabbed feature containers for complex domains
- Location: `components/workspaces/*.jsx`, `app/app/(protected)/[workspace]/page.js`
- Contains: TabPanel containers, workspace-specific feature views (Finance, Operations, Master Data)
- Depends on: API, dashboard components, UI components
- Used by: Protected routes

**UI Component Layer:**
- Purpose: Reusable, domain-agnostic UI primitives
- Location: `components/ui/*.jsx`
- Contains: DateRangeFilter, WarehouseSelector, ToastProvider, HoverScrollbar
- Depends on: React, Tailwind, third-party libs (lucide-react)
- Used by: All feature components

## Data Flow

### Primary Request Path (Authenticated User Landing)

1. **Route Guard** (`app/app/(protected)/layout.js`) — Renders AccessLayout
2. **Access Check** (`components/layout/AccessLayout.jsx:line 37-46`) — Validates token, checks permissions/access rules
3. **Nav Rendering** (`lib/navigation.js`) — Filters nav items based on role and permissions
4. **AppShell Render** (`components/layout/AppShell.jsx`) — Wraps page with sidebar + top nav
5. **Page Render** (e.g., `app/app/(protected)/dashboard/page.js`) — Dispatches to role-specific component
6. **Data Fetch** (e.g., `components/dashboard/AdminDashboard.jsx:line 22-40`) — Uses `apiFetch` to load summaries, charts
7. **Response & Render** — Data cached, component state updates, UI renders

### Dashboard Load Flow

1. User navigates to `/app/dashboard`
2. DashboardPage (`app/app/(protected)/dashboard/page.js`) extracts role from token
3. Conditional render dispatches to correct dashboard component (AdminDashboard, RetailerDashboard, etc.)
4. Dashboard component calls `apiFetch` with parameters (warehouse ID, date range)
5. API response cached via `apiFetchCached`
6. Component renders stat cards, charts, tables populated with live data

### Workspace Tab Flow

1. User navigates to `/app/finance`
2. FinanceWorkspacePage (`app/app/(protected)/finance/page.js`) renders WorkspaceTabs
3. Tab selection sets active key in state
4. Active tab renders appropriate panel (e.g., InvoicesPanel)
5. Panel fetches data with optional filters (warehouse, date range)
6. Data displayed in tables/charts within panel

### Outlet Finder Flow

1. Driver or salesman navigates to `/app/outlet-finder`
2. OutletFinder component loads (location: `components/outlet-finder/`)
3. Uses geolocation and map to show retailers
4. Route optimization via OSRM (`lib/route.js:optimizeWithOSRM`) or greedy nearest algorithm
5. Driver accepts/launches route assignment
6. Real-time status updates via polling or webhook

**State Management:**
- Local component state (useState) for UI state (filters, selected items, loading states)
- Derived state from token parsing (role, user ID, permissions)
- Cached API responses in memory Map (`apiCache` in `lib/api.js`)
- No external state manager (Redux/Zustand) — component-local + context (ToastProvider)

## Key Abstractions

**API Fetch Pattern:**
- Purpose: Unified HTTP layer with auth, error handling, response caching
- Examples: `lib/api.js` — `apiFetch`, `apiFetchCached`, `apiFetchBlob`
- Pattern: Fetch wrapper that injects Bearer token, handles 401 errors with logout, formats error details

**Dashboard Dispatcher:**
- Purpose: Render role-appropriate dashboard without conditional rendering in components
- Examples: `app/app/(protected)/dashboard/page.js`
- Pattern: Extract role from token, switch render based on role, fallback to "not available"

**Workspace Panel Pattern:**
- Purpose: Encapsulate a feature domain within a tab interface
- Examples: `components/workspaces/InvoicesPanel.jsx`, `components/workspaces/FinancePanel.jsx`
- Pattern: Panel receives warehouseId and date range, fetches data, renders table + charts, handles mutations

**Permission Predicate:**
- Purpose: Granular access control at component level
- Examples: `lib/hooks/usePermissions.js`, `lib/accessRules.js`
- Pattern: Load permissions from `/auth/me`, define access rules per path, check predicate before rendering

**Route Optimization Adapter:**
- Purpose: Switch between OSRM and greedy nearest based on OSRM availability
- Examples: `lib/route.js:optimizeRoute`
- Pattern: Try OSRM first, catch error, fall back to greedy nearest algorithm

## Entry Points

**Public Landing:**
- Location: `app/page.js`
- Triggers: Fresh browser load, `/` route
- Responsibilities: Render marketing landing, navigation to login/app

**Login:**
- Location: `app/login/page.js`
- Triggers: Unauthenticated user accesses protected route or visits `/login`
- Responsibilities: Form input, API call to `/auth/login`, token save, redirect to dashboard

**Protected App:**
- Location: `app/app/(protected)/layout.js` → `components/layout/AccessLayout.jsx`
- Triggers: Authenticated user accesses `/app/*`
- Responsibilities: Validate token, check permissions, render AppShell + child pages

**Demo:**
- Location: `app/demo/page.js` and sub-pages
- Triggers: User visits `/demo`
- Responsibilities: Render static/simulated order management interface for demo purposes

## Architectural Constraints

- **Threading:** Single-threaded event loop (browser). API calls are async but non-blocking. No worker threads used.
- **Global state:** Token cached in `memoryTokens` object in `lib/auth.js` (module-level singleton). API cache in `apiCache` Map in `lib/api.js`. ToastProvider context for toast notifications.
- **Circular imports:** None detected. Utilities (`lib/`) do not import from components; components import utilities.
- **Client-side rendering:** App layer is "use client" (React client components). This disables server-side rendering for protected routes, requiring client-side token validation.
- **API base URL:** Configured via `NEXT_PUBLIC_API_BASE_URL` env var. Falls back to empty string (relative URLs).
- **Session storage:** Tokens stored in browser sessionStorage (clears on tab close). Memory fallback for SSR contexts.

## Anti-Patterns

### Global Token Caching Without Refresh Logic

**What happens:** Token stored in `memoryTokens` object and sessionStorage in `lib/auth.js`. No automatic refresh on expiry.
**Why it's wrong:** Expired token causes silent 401 errors or repeated failed API calls until user manually logs out.
**Do this instead:** Implement refresh token flow (401 → request new token → retry original request) or add token expiry check before requests.

### Role-Based Conditional Rendering Without Granular Permissions

**What happens:** Navigation items filtered by role only (`lib/navigation.js`), not by individual permission codes.
**Why it's wrong:** User can navigate to page their role allows but lacks permission for specific action (e.g., Delete User). Page renders but actions fail.
**Do this instead:** Combine role check with permission code check. Use `usePermissions.hasPermission(code)` to conditionally render buttons/links based on specific permission, not just role.

### API Caching Without Invalidation Strategy

**What happens:** `apiFetchCached` caches responses for 5 minutes. Updates via mutations (POST/PUT/DELETE) don't clear cache automatically.
**Why it's wrong:** User creates order, but dashboard shows stale data until cache expires or manual refresh.
**Do this instead:** Export and call `invalidateApiCache(path)` after mutations. Add cache tags or version keys for fine-grained invalidation.

### Unreliable Route Optimization Fallback

**What happens:** `lib/route.js:optimizeRoute` calls OSRM API, falls back to greedy nearest. OSRM outages = all users degraded to simple algorithm.
**Why it's wrong:** Route quality degrades unpredictably. No user feedback when fallback is active.
**Do this instead:** Log fallback events. Implement exponential backoff. Add toggle to admin panel to disable OSRM if experiencing issues.

## Error Handling

**Strategy:** Async error catching in components and API layer with user-facing messages.

**Patterns:**
- API errors caught in try/catch, formatted via `formatErrorDetail` to extract server error message
- 401 errors trigger auto-logout via `logout()` call in `lib/api.js`
- Component errors logged to state and displayed in UI (e.g., `error` state in AdminDashboard)
- Toast notifications via ToastProvider for transient feedback
- Network errors show fallback message: "Request failed" or server-provided detail

## Cross-Cutting Concerns

**Logging:** Console.log used in development. No structured logging library. Error messages captured in component state.

**Validation:** Zod imported in package but not widely used in frontend. Form validation mostly reactive (onChange handlers check length/format).

**Authentication:** JWT tokens in Authorization header. Role embedded in token payload. Permissions fetched from `/auth/me` endpoint and cached.

**Caching:** Two-level: API response caching (5 min TTL, in-flight deduplication) and component state (local useState).

---

*Architecture analysis: 2026-07-13*
