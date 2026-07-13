# Technology Stack

**Analysis Date:** 2026-07-13

## Languages

**Primary:**
- JavaScript (JSX/modern ES2020+) - Frontend components, routing, business logic
- Used throughout `app/`, `components/`, `lib/` directories

## Runtime

**Environment:**
- Node.js v22.22.0
- Next.js 16.1.6 (App Router)

**Package Manager:**
- npm 10.9.4
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js 16.1.6 - React framework, App Router, server-side rendering, API routes
- React 18.3.1 - UI component library
- React DOM 18.3.1 - DOM rendering

**UI & Styling:**
- Tailwind CSS 3.4.4 - Utility-first CSS framework (`tailwind.config.js`)
- PostCSS 8.4.38 - CSS processing (`postcss.config.js`)
- Autoprefixer 10.4.19 - Vendor prefix handling
- Motion 12.40.0 - Animation library (`motion/react`)

**Data & Tables:**
- TanStack React Table 8.21.3 - Headless table component library (`components/tables/DataTable.jsx`)

**Forms & Validation:**
- Zod 3.25.76 - TypeScript-first schema validation (`app/demo/_lib/validation.js`)

**Utilities:**
- dayjs 1.11.13 - Date/time manipulation (`lib/format.js`)
- lucide-react 0.487.0 - Icon library

**Notifications:**
- sonner 2.0.7 - Toast notifications (`app/demo/_components/Shell.jsx`)

## Maps & Geolocation

- Leaflet 1.9.4 - Interactive maps library
- React Leaflet 4.2.1 - React wrapper for Leaflet (`components/outlet-finder/OutletMap.jsx`)
- Browser Geolocation API - Native GPS access (`lib/route.js`)
- Project OSRM - Route optimization API (https://router.project-osrm.org)
- Google Maps URLs - Google Maps directions integration (`lib/route.js`)

## Document Processing

- pdf-lib 1.17.1 - PDF manipulation (`components/workspaces/BillLabelsPanel.jsx`)
- pdfjs-dist 5.6.205 - PDF viewing/rendering
- qrcode 1.5.4 - QR code generation (`components/workspaces/BillLabelsPanel.jsx`)
- tesseract.js 7.0.0 - OCR (Optical Character Recognition)

**Chart & Data Visualization:**
- recharts 2.12.7 - React chart library (`components/charts/PieChartCard.jsx`)

## Development Tools

**Linting:**
- ESLint 9.39.2 - JavaScript linting
- eslint-config-next 16.1.1 - Next.js ESLint config

**Build:**
- Next.js build system (included with framework)

## Configuration

**Environment:**
- Configuration via environment variables (prefix: `NEXT_PUBLIC_` for client-side)
- Environment variables are loaded from `.env` and `.env.local` files (not committed)

**Key Environment Variables:**
- `NEXT_PUBLIC_API_BASE_URL` - Backend API endpoint (`lib/api.js`)
- `N8N_ANALYSE_WEBHOOK_URL` - N8N webhook for analysis feature (server-only)
- `N8N_WEBHOOK_SECRET` - Webhook authentication secret (server-only)

**Build Configuration:**
- `next.config.mjs` - Next.js configuration (minimal, default setup)
- `jsconfig.json` - JavaScript compiler options with path aliases (`@/*` → project root)
- `.eslintrc.json` - ESLint configuration extending Next.js core-web-vitals
- `tailwind.config.js` - Tailwind CSS configuration with semantic color tokens
- `postcss.config.js` - PostCSS plugins configuration

## Platform Requirements

**Development:**
- Node.js v22.22.0+
- npm 10.9.4+
- Modern browser with ES2020+ support

**Production:**
- Deployment target: Vercel (Next.js serverless platform)
- Server-side route supports 60-second timeout for agent analysis (`app/demo/api/agent/analyse/route.js`)
- Requires backend API at `NEXT_PUBLIC_API_BASE_URL`

---

*Stack analysis: 2026-07-13*
