# External Integrations

**Analysis Date:** 2026-07-13

## APIs & External Services

**Route Optimization:**
- Project OSRM (Open Source Routing Machine) - Trip optimization and distance/duration calculation
  - URL: `https://router.project-osrm.org/trip/v1/driving`
  - Usage: Optimize delivery routes for drivers (`lib/route.js` → `optimizeWithOSRM()`)
  - Fallback: Uses greedy nearest-neighbor algorithm if OSRM fails

**Maps & Navigation:**
- Google Maps - Turn-by-turn directions and waypoint navigation
  - URL: Built as `https://www.google.com/maps/dir/` with origin, destination, waypoints
  - Usage: Generates shareable navigation links for routes (`lib/route.js` → `buildMapsUrl()`)

**AI/Agent Analysis (Demo):**
- N8N - Workflow automation platform with LLM integration
  - Webhook URL: `process.env.N8N_ANALYSE_WEBHOOK_URL`
  - Auth: `process.env.N8N_WEBHOOK_SECRET` sent as `X-Ascend-Webhook-Secret` header
  - Upstream: N8N connects to OpenAI for analysis recommendations
  - Timeout: 60 seconds (configured in `app/demo/api/agent/analyse/route.js`)
  - Idempotency: Tracks via `X-Ascend-Idempotency-Key` header
  - Response: Returns analysis recommendations with basket and retailer data
  - Location: `app/demo/api/agent/_n8n.js` (forwarder), `app/demo/api/agent/analyse/route.js` (endpoint)

## Data Storage

**Backend API:**
- RESTful API server (location configurable)
  - Connection: `process.env.NEXT_PUBLIC_API_BASE_URL`
  - Client: Native `fetch()` API with custom wrappers
  - Authentication: Bearer token (JWT stored in sessionStorage)
  - Credentials: Cookies sent with `credentials: 'include'`

**Client-Side Storage:**
- sessionStorage - JWT tokens (access + refresh)
  - `ascend_access_token` - Current access token
  - `ascend_refresh_token` - Refresh token (if provided)
  - Location: `lib/auth.js` (token management)
- localStorage - Demo authentication flag only
  - `AUTH_KEY` - Demo login state
  - Location: `app/demo/_components/Shell.jsx`

**No databases:** This is a frontend-only application; all persistent data lives in backend API.

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based authentication (backend-managed)
  - Implementation: Bearer token in `Authorization` header
  - Token storage: sessionStorage (in-memory + session persistence)
  - Token format: JWT with `user_id`, `email`, `role` claims
  - Auto-logout: Triggered on HTTP 401 responses (token expired/invalid)
  - Location: `lib/auth.js` contains all token/auth logic

**Token Management:**
- `saveTokens()` - Store access + refresh tokens
- `getAccessToken()` - Retrieve current access token
- `parseJwt()` - Decode JWT payload
- `getRoleFromToken()` - Extract role from token (`DRIVER`, `BRAND`, `RETAILER`, admin roles)
- `logout()` - Clear tokens and redirect to `/login`

## Maps & Geolocation

**Browser Geolocation:**
- Native HTML5 Geolocation API - User's GPS position
  - Usage: Get driver's current location for outlet finder
  - Options: High accuracy enabled, 10-second timeout
  - Location: `lib/route.js` → `getCurrentPos()`

**Maps Visualization:**
- Leaflet (open-source) + React Leaflet wrapper
  - Tile layers: Configurable via Leaflet (default: OpenStreetMap)
  - Markers: Driver and outlet locations
  - Popups: Outlet details on marker click
  - Location: `components/outlet-finder/OutletMap.jsx`

## Document & QR Generation

**PDF Creation:**
- pdf-lib - PDF generation/editing for bill labels
  - Usage: Create printable label PDFs with customer/order details
  - Location: `components/workspaces/BillLabelsPanel.jsx`

**QR Code:**
- qrcode - Generate QR codes for bill labels
  - Usage: Encode outlet/order identifiers as scannable codes
  - Location: `components/workspaces/BillLabelsPanel.jsx`

**PDF Rendering:**
- pdfjs-dist - PDF viewer for displaying uploaded bill label templates
  - Usage: Preview PDFs before processing
  - Location: `components/workspaces/BillLabelsPanel.jsx`

**OCR (Optical Character Recognition):**
- tesseract.js - Extract text from images/scans
  - Usage: Recognize text from uploaded delivery photos/documents (implied)
  - Location: Available in dependencies, specific usage not visible in current scan

## Monitoring & Observability

**Error Tracking:**
- None detected - No Sentry, Datadog, or other error tracking service configured

**Logs:**
- Browser console logging only
- No centralized log aggregation
- Toast notifications for user-facing errors (`sonner` library)

**API Error Handling:**
- Structured error responses from backend
- Error detail extraction and user-friendly messages
- Location: `lib/api.js` → `formatErrorDetail()`, `apiFetch()` error handling

## CI/CD & Deployment

**Hosting:**
- Vercel (Next.js native platform)
  - Serverless functions for API routes
  - Server-side timeout: 60 seconds for agent analysis

**CI Pipeline:**
- None detected - No GitHub Actions, GitLab CI, or other automation configured

## Environment Configuration

**Required Environment Variables:**

Client-side (prefixed with `NEXT_PUBLIC_`):
- `NEXT_PUBLIC_API_BASE_URL` - Backend API base URL (e.g., `http://localhost:8000`)

Server-side (not exposed to browser):
- `N8N_ANALYSE_WEBHOOK_URL` - N8N webhook endpoint for AI analysis
- `N8N_WEBHOOK_SECRET` - Authentication secret for N8N webhook

**Secrets Location:**
- `.env` - Local environment file (not committed)
- `.env.local` - Local overrides (not committed)
- Vercel environment variables - For production deployment
- Process environment at runtime - Node.js `process.env`

## API Endpoints

**Backend API Structure** (configured in `lib/api.js`):

Authentication:
- `POST /auth/login` - User login
- `GET /auth/me` - Current user info
- `POST /auth/me/password` - Change password
- `GET /auth/access-rules` - User permissions/access rules

Admin Dashboard:
- `GET /admin/orders` - Order list
- `POST /admin/orders` - Create order
- `GET /admin/orders/export` - Export orders
- `GET /admin/orders/status-summary` - Order status summary
- `GET /admin/inventory` - Inventory list
- `GET /admin/brands` - Brand lookup
- `GET /admin/retailers` - Retailer lookup
- `GET /admin/salesmen` - Salesman lookup
- `GET /admin/drivers` - Driver lookup
- `GET /admin/skus` - Product SKU lookup
- `GET /admin/warehouses` - Warehouse lookup
- `GET /admin/company-profile` - Company info
- `GET /admin/lookups` - Reference data
- `GET /admin/summary` - Dashboard summary
- User management: `/admin/users`, `/admin/users/{id}/password`, `/admin/users/{id}/role`, etc.
- Permissions: `/admin/permissions`, `/admin/groups`, `/admin/groups/{id}/permissions`
- Access rules: `/admin/access-rules`

Orders:
- `GET /orders` - List orders
- `POST /orders` - Create order
- `GET /orders/{id}` - Order detail
- `POST /orders/{id}/status` - Update order status
- `GET /orders/{id}/invoice-view` - Invoice HTML view
- `GET /orders/{id}/invoice.pdf` - Invoice PDF

Imports:
- `POST /imports` - Upload import file
- `POST /imports/daily-sales` - Import daily sales data
- `GET /imports/template` - Download import template

Brand Dashboard:
- `GET /brand/dashboard` - Brand-specific dashboard

Retailer Dashboard:
- `GET /retailer/dashboard` - Retailer-specific dashboard
- `GET /retailer/orders` - Retailer's orders

Credit Notes:
- `GET /credit-notes/{id}/view` - Credit note view

Bill Labels:
- `GET /bill-labels` - List labels
- `POST /bill-labels` - Create label
- `GET /bill-labels/{id}` - Label detail
- `PUT /bill-labels/{id}` - Update label
- `DELETE /bill-labels/{id}` - Delete label

Outlet Finder (Driver):
- `GET /outlet-finder/retailers/lookup` - Search retailers by location
- `POST /outlet-finder/deliveries/mark` - Mark delivery as complete
- `GET /outlet-finder/assignments` - List all assignments
- `GET /outlet-finder/assignments/mine` - Driver's assignments
- `POST /outlet-finder/assignments/{id}/accept` - Accept assignment

Accounting:
- `GET /accounting/payments` - Payment records
- `GET /accounting/credit-notes` - Credit notes
- `GET /accounting/outstanding` - Outstanding receivables
- `GET /accounting/outstanding/summary` - Outstanding summary
- `GET /accounting/collections` - Collection records
- `GET /accounting/collections/summary` - Collections summary
- `POST /accounting/payments/multi` - Record multiple payments

Dashboard Analytics:
- `GET /dashboard/daily-sales` - Daily sales data
- `GET /dashboard/salesman-performance` - Salesman KPIs

## Webhooks & Callbacks

**Incoming:**
- `POST /demo/api/agent/analyse` - Proxy endpoint for N8N analysis requests
  - Validates input, forwards to N8N, validates response, returns to client
  - Location: `app/demo/api/agent/analyse/route.js`

**Outgoing:**
- N8N webhook calls (from Next.js to N8N, not from external to this app)

**No external webhooks:** This app does not currently expose webhook endpoints for external services to call (all API routes are for internal demo/agent functionality).

---

*Integration audit: 2026-07-13*
