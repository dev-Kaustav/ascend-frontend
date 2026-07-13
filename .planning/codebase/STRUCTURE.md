# Codebase Structure

**Analysis Date:** 2026-07-13

## Directory Layout

```
ascend-frontend/
├── app/                              # Next.js App Router
│   ├── layout.js                     # Root layout (fonts, metadata, SEO)
│   ├── page.js                       # Landing page (marketing)
│   ├── globals.css                   # Global Tailwind + custom styles
│   ├── robots.js                     # SEO robots.txt
│   ├── sitemap.js                    # SEO sitemap.xml
│   ├── login/                        # Login page (public route)
│   │   └── page.js
│   ├── app/                          # App shell layout
│   │   ├── layout.js                 # App wrapper (ToastProvider)
│   │   ├── page.js                   # App index redirect
│   │   └── app.css
│   ├── (protected)/                  # Protected route group
│   │   ├── layout.js                 # Access control + AppShell
│   │   ├── dashboard/
│   │   │   └── page.js               # Role-based dashboard dispatcher
│   │   ├── finance/
│   │   │   └── page.js               # Finance workspace (tabbed)
│   │   ├── operations/
│   │   │   └── page.js               # Operations workspace (drivers, coverage, etc.)
│   │   ├── orders/
│   │   │   ├── page.js               # Orders list
│   │   │   ├── new/                  # New order creation
│   │   │   └── [orderId]/            # Order detail
│   │   ├── master-data/
│   │   │   └── page.js               # Master data workspace
│   │   ├── admin/
│   │   │   └── page.js               # Admin panel
│   │   ├── outlet-finder/
│   │   │   └── page.js               # Outlet finder/route assignment
│   │   ├── imports/
│   │   │   └── page.js               # Bulk import interface
│   │   ├── invoice-labels/
│   │   │   └── page.js
│   │   ├── profile/
│   │   │   └── page.js               # User profile
│   │   ├── users/
│   │   │   └── page.js               # User management (admin)
│   │   ├── inventory/
│   │   │   ├── page.js               # Inventory view (deprecated, moved to ops)
│   │   │   └── add/                  # Add inventory
│   │   └── [legacy-routes]/          # Removed routes with redirects
│   │       └── page.js
│   ├── demo/                         # Demo/sandbox environment
│   │   ├── page.js                   # Demo command center
│   │   ├── layout.js
│   │   ├── _data/                    # Static demo data
│   │   │   ├── skuMaster.js
│   │   │   ├── retailers.js
│   │   │   ├── executions.js
│   │   │   └── orderHistory.js
│   │   ├── _lib/                     # Demo-specific utilities
│   │   │   ├── client.js
│   │   │   ├── simulation.js
│   │   │   ├── stateMachine.js
│   │   │   ├── validation.js
│   │   │   ├── theme.js
│   │   │   ├── overview.js
│   │   │   └── idempotency.js
│   │   ├── _components/              # Demo-specific components
│   │   │   ├── DemoProvider.jsx
│   │   │   ├── Shell.jsx
│   │   │   ├── WorkflowPieces.jsx
│   │   │   └── shared.jsx
│   │   ├── workflow/                 # Demo workflow view
│   │   │   └── page.js
│   │   ├── retailers/                # Demo retailer management
│   │   │   ├── page.js
│   │   │   └── [id]/
│   │   ├── orders/                   # Demo orders view
│   │   │   └── page.js
│   │   ├── executions/               # Demo workflow executions
│   │   │   ├── page.js
│   │   │   └── [executionId]/
│   │   └── api/                      # Demo backend API routes
│   │       ├── agent/
│   │       │   └── route.js
│   │       └── [...]
│   ├── contact/                      # Contact page
│   │   └── page.js
│   ├── product/
│   │   └── page.js
│   ├── why-ascend/
│   │   └── page.js
│   ├── how-it-works/
│   │   └── page.js
│   ├── who-its-for/
│   │   └── page.js
│   ├── privacy-policy/
│   │   └── page.js
│   └── [other-marketing-routes]/
│
├── components/                       # React components
│   ├── ui/                           # Reusable UI primitives
│   │   ├── ToastProvider.jsx         # Toast notification context
│   │   ├── DateRangeFilter.jsx       # Date range picker
│   │   ├── WarehouseSelector.jsx     # Warehouse dropdown
│   │   ├── InputBars.jsx             # Input field with bars
│   │   ├── HoverScrollbar.jsx        # Custom scrollbar
│   │   └── [other-ui-components]
│   ├── dashboard/                    # Role-based dashboard views
│   │   ├── AdminDashboard.jsx        # Admin overview
│   │   ├── AccountantDashboard.jsx   # Finance overview
│   │   ├── BrandDashboard.jsx        # Brand/vendor overview
│   │   ├── WarehouseDashboard.jsx    # Warehouse manager overview
│   │   ├── RetailerDashboard.jsx     # Retailer overview
│   │   ├── SalesmanDashboard.jsx     # Salesman overview
│   │   └── DriverDashboard.jsx       # Driver overview
│   ├── layout/                       # Layout components
│   │   ├── AccessLayout.jsx          # Protected route access control
│   │   ├── AppShell.jsx              # Main app shell (nav, sidebar)
│   │   ├── WorkspaceTabs.jsx         # Tabbed workspace container
│   │   ├── StatCard.jsx              # Metric card component
│   │   ├── SectionCard.jsx           # Section container
│   │   └── RemovedRouteNotice.jsx    # Redirect notice for migrated routes
│   ├── workspaces/                   # Feature workspace panels
│   │   ├── FinancePanel.jsx          # (deprecated, now in Finance workspace page)
│   │   ├── AccountingPanel.jsx       # Finance overview tab
│   │   ├── InvoicesPanel.jsx         # Invoices tab
│   │   ├── OutstandingPanel.jsx      # Outstanding receivables
│   │   ├── CreditNotesPanel.jsx      # Credit notes tab
│   │   ├── CashCollectionPanel.jsx   # Cash collection tab
│   │   ├── DailySalesPanel.jsx       # Daily sales reporting
│   │   ├── DriversPanel.jsx          # Operations: drivers tab
│   │   ├── RetailCoveragePanel.jsx   # Operations: coverage tab
│   │   ├── SalesmenPanel.jsx         # Sales team management
│   │   ├── BrandsPanel.jsx           # Brand management
│   │   ├── CatalogPanel.jsx          # SKU catalog
│   │   ├── InventoryPanel.jsx        # Inventory management
│   │   ├── CashCollectionPanel.jsx   # Cash collection
│   │   ├── BillLabelsPanel.jsx       # Bill label printing
│   │   ├── UsersAdminPanel.jsx       # User management
│   │   └── QuickCreateWorkspacePanel.jsx
│   ├── outlet-finder/                # Outlet/route assignment features
│   │   ├── OutletMap.jsx             # Leaflet map display
│   │   ├── ManualFinder.jsx          # Ad-hoc outlet routing
│   │   ├── RouteLauncher.jsx         # Route confirmation
│   │   ├── RouteView.jsx             # Active route view
│   │   ├── RouteStops.jsx            # Stop list in route
│   │   ├── DriverJobs.jsx            # Driver assignment view
│   │   ├── AssignmentsList.jsx       # Historical assignments
│   │   ├── AssignToDriver.jsx        # Driver selection modal
│   │   └── MarkDeliveredButton.jsx   # Delivery confirmation
│   ├── orders/                       # Order management components
│   │   ├── OrderList.jsx             # Orders table
│   │   ├── OrderDetail.jsx           # Order view/edit
│   │   ├── OrderCreate.jsx           # New order form
│   │   ├── OrderLines.jsx            # Line items
│   │   └── [order-related-components]
│   ├── charts/                       # Chart components
│   │   ├── LineChartCard.jsx         # Time series chart
│   │   ├── BarChartCard.jsx          # Bar chart
│   │   ├── PieChartCard.jsx          # Pie/donut chart
│   │   └── [other-chart-components]
│   ├── tables/                       # Table components
│   │   ├── DataTable.jsx             # Generic data table (TanStack Table)
│   │   └── [specific-tables]
│   ├── drivers/                      # Driver-specific components
│   │   ├── AdminDrivers.jsx          # Admin driver view
│   │   └── WarehouseDrivers.jsx      # Warehouse manager driver view
│   ├── landing/                      # Marketing landing page sections
│   │   ├── Navbar.jsx                # Top navigation
│   │   ├── SystemStory.jsx           # Hero section
│   │   ├── RetailerSection.jsx
│   │   ├── BrandSection.jsx
│   │   ├── FoundersSection.jsx
│   │   ├── ConversionSection.jsx
│   │   ├── BrandStrip.jsx
│   │   ├── ConveyorEnvironment.jsx
│   │   ├── Footer.jsx
│   │   ├── Logo.jsx
│   │   └── [landing-sections]
│   └── admin/                        # Admin panel components
│       ├── AdminPanel.jsx
│       └── [admin-features]
│
├── lib/                              # Utility modules
│   ├── api.js                        # API client with auth + caching
│   ├── auth.js                       # Token management, JWT parsing
│   ├── navigation.js                 # Role-based nav config
│   ├── route.js                      # Route optimization (OSRM, greedy)
│   ├── format.js                     # Data formatting utilities
│   ├── geo.js                        # Geolocation utilities (haversine)
│   ├── orders.js                     # Order-specific helpers
│   ├── accessRules.js                # Access control rules per path
│   ├── workspaceRoutes.js            # Workspace routing logic
│   └── hooks/                        # Custom React hooks
│       ├── usePermissions.js         # Permission checking hook
│       ├── useAccessRules.js         # Access rules loading hook
│       ├── useLineItems.js           # Order line items hook
│       └── useAdminLookups.js        # Lookup data hook
│
├── public/                           # Static assets
│   ├── ascend-conveyor.svg
│   ├── [images, icons, etc]
│   └── [other-static-files]
│
├── .planning/                        # GSD planning docs
│   └── codebase/
│       ├── ARCHITECTURE.md
│       ├── STRUCTURE.md
│       ├── CONVENTIONS.md
│       ├── TESTING.md
│       ├── STACK.md
│       ├── INTEGRATIONS.md
│       └── CONCERNS.md
│
├── .next/                            # Next.js build output (git ignored)
├── node_modules/                     # Dependencies (git ignored)
│
├── .env                              # Environment variables (git ignored)
├── .env.local                        # Local overrides (git ignored)
├── .eslintrc.json                    # ESLint config
├── .gitignore
├── eslint.config.mjs                 # Modern ESLint flat config
├── jsconfig.json                     # JS/JSX path aliases
├── next.config.mjs                   # Next.js configuration
├── package.json                      # Dependencies
├── package-lock.json                 # Lockfile
├── postcss.config.js                 # PostCSS (Tailwind)
├── tailwind.config.js                # Tailwind CSS config
└── README.md
```

## Directory Purposes

**`app/`:**
- Purpose: Next.js App Router pages and layouts
- Contains: Route definitions (pages.js), route groups ((protected)), layouts, SEO metadata
- Key files: `layout.js` (root), `page.js` (landing), `(protected)/layout.js` (access control)

**`components/`:**
- Purpose: Reusable React components organized by feature/domain
- Contains: UI primitives, dashboard views, workspace panels, layout shells
- Key files: `ui/` (primitives), `dashboard/` (role dispatchers), `layout/AccessLayout.jsx` (auth)

**`lib/`:**
- Purpose: Shared utilities and custom hooks
- Contains: API client, auth, navigation, formatting, hooks
- Key files: `api.js` (fetch wrapper), `auth.js` (token mgmt), `hooks/` (custom hooks)

**`public/`:**
- Purpose: Static assets served directly
- Contains: Images, logos, fonts (if not from CDN)

**`.planning/codebase/`:**
- Purpose: GSD codebase analysis documents
- Contains: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, STACK.md, INTEGRATIONS.md, CONCERNS.md

## Key File Locations

**Entry Points:**
- `app/layout.js` — Root layout (fonts, SEO, context providers)
- `app/page.js` — Marketing landing page
- `app/login/page.js` — Authentication entry
- `app/app/(protected)/layout.js` — Protected route guard (AccessLayout)
- `app/demo/page.js` — Demo interface

**Configuration:**
- `jsconfig.json` — Path aliases (@/ → src root)
- `tailwind.config.js` — Tailwind customization (fonts, colors, spacing)
- `next.config.mjs` — Next.js runtime config
- `postcss.config.js` — PostCSS pipeline (autoprefixer, Tailwind)
- `package.json` — Dependencies and scripts

**Core Logic:**
- `lib/api.js` — HTTP client with auth, caching, error handling
- `lib/auth.js` — JWT token management and parsing
- `lib/navigation.js` — Role-based navigation structure
- `components/layout/AccessLayout.jsx` — Permission validation and routing
- `components/layout/AppShell.jsx` — Main layout shell (nav, sidebar)

**Testing:**
- Not found. No Jest, Vitest, or test files in repo.

## Naming Conventions

**Files:**
- Pages: `page.js` (Next.js convention)
- Components: PascalCase `.jsx` (e.g., `AdminDashboard.jsx`, `ToastProvider.jsx`)
- Utilities: camelCase `.js` (e.g., `api.js`, `auth.js`, `format.js`)
- Styles: Component-scoped CSS or Tailwind classes (no separate .css for component logic)

**Directories:**
- Feature domains: lowercase (e.g., `dashboard`, `orders`, `outlet-finder`)
- Component subdirs: feature-named (e.g., `components/dashboard/`, `components/workspaces/`)
- Utilities: lowercase (e.g., `lib/hooks/`)
- Route groups: parentheses syntax (e.g., `(protected)`, `(auth)`)

**Component Naming:**
- Page components: `[Feature]Page` or just feature name (e.g., `DashboardPage`, `LoginPage`)
- Panel/feature components: `[Feature]Panel` (e.g., `InvoicesPanel`, `DailySalesPanel`)
- Dashboard variants: `[Role]Dashboard` (e.g., `AdminDashboard`, `RetailerDashboard`)
- Utility components: Domain-specific (e.g., `DateRangeFilter`, `WarehouseSelector`)

**Function Naming:**
- Hooks: `use[Feature]` (e.g., `usePermissions`, `useAccessRules`, `useLineItems`)
- Utilities: camelCase (e.g., `apiFetch`, `recomputeDistances`, `getRoleFromToken`)
- Async functions: verb-first (e.g., `fetchOrders`, `submitForm`, `loadData`)

**Variable Naming:**
- State vars: camelCase (e.g., `loading`, `error`, `selectedItem`)
- Constants: UPPER_SNAKE_CASE (e.g., `MAPS_BATCH_SIZE`, `ACCESS_TOKEN_KEY`)
- Boolean predicates: `is*` or `has*` prefix (e.g., `isLoading`, `hasPermission`, `removedLegacyPath`)

**Types/Interfaces:**
- Not using TypeScript. Prop shapes documented via prop validation or inline comments.

## Where to Add New Code

**New Feature (e.g., new workspace or dashboard panel):**
- Primary code: `components/[feature-domain]/[Feature]Panel.jsx`
- Page wrapper: `app/app/(protected)/[feature]/page.js`
- Utilities: `lib/[feature].js` if feature-specific logic
- Example: Adding "Reports" workspace
  1. Create `components/workspaces/ReportsPanel.jsx` with data fetching and UI
  2. Create `app/app/(protected)/reporting/page.js` with WorkspaceTabs
  3. Add navigation link to `lib/navigation.js` under relevant roles
  4. Add access rule to `lib/accessRules.js` if role-restricted

**New Component/Module:**
- Reusable UI component: `components/ui/[Component].jsx`
- Dashboard role variant: `components/dashboard/[Role]Dashboard.jsx`
- Workspace panel: `components/workspaces/[Panel]Panel.jsx`
- Layout/structural: `components/layout/[Component].jsx`
- Example: Adding "UserAvatar" UI component
  1. Create `components/ui/UserAvatar.jsx`
  2. Use in `components/layout/AppShell.jsx` or other layout components

**Utilities/Helpers:**
- Shared API helpers: `lib/api.js` (extend `apiEndpoints` object)
- Formatting/validation: `lib/format.js` or new file `lib/[domain].js`
- Custom hooks: `lib/hooks/use[Feature].js`
- Example: Adding order formatting helper
  1. Add function to `lib/format.js` (e.g., `formatOrderStatus`)
  2. Import in component (e.g., `components/orders/OrderList.jsx`)

**Marketing/Landing Pages:**
- Page section: `components/landing/[Section].jsx`
- Page route: `app/[route]/page.js`
- Example: Adding "Testimonials" section
  1. Create `components/landing/TestimonialsSection.jsx`
  2. Import and add to `app/page.js` after other sections
  3. Update `app/layout.js` metadata if new route

**Access Control/Permissions:**
- Nav items: Update `lib/navigation.js` NAV_CONFIG for role
- Access rules: Update `lib/accessRules.js` to define which roles/permissions can access path
- Hook permission check: Use `usePermissions().hasPermission(code)` in component

**Tests:**
- No test framework configured. If adding, use Jest/Vitest:
  1. Create `[feature].test.js` next to source file or in `__tests__/` dir
  2. Update `package.json` with test runner and config

## Special Directories

**`app/(protected)/`:**
- Purpose: Route group for authenticated routes
- Generated: No (static directory)
- Committed: Yes
- Significance: All child routes require authentication via AccessLayout wrapper

**`app/demo/`:**
- Purpose: Demo/sandbox environment with static data
- Generated: No
- Committed: Yes
- Significance: Allows testing UI without backend API. Uses `DemoProvider` context for state.

**`.planning/`:**
- Purpose: GSD planning documentation
- Generated: No (manually created)
- Committed: Yes
- Significance: Codebase analysis and task planning docs

**`.next/`:**
- Purpose: Next.js build output
- Generated: Yes (run `npm run build`)
- Committed: No (.gitignore)

**`node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes (run `npm install`)
- Committed: No (.gitignore)

---

*Structure analysis: 2026-07-13*
