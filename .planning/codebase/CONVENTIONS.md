# Coding Conventions

**Analysis Date:** 2026-07-13

## Naming Patterns

**Files:**
- React components: PascalCase (e.g., `DemoProvider.jsx`, `ToastProvider.jsx`, `RouteLauncher.jsx`)
- Utility/helper modules: camelCase (e.g., `api.js`, `auth.js`, `format.js`, `orders.js`)
- Hook files: camelCase with `use` prefix (e.g., `useAccessRules.js`, `usePermissions.js`, `useLineItems.js`)
- Layout/page files: lowercase (e.g., `page.js`, `layout.js`)
- Private/internal modules: underscore prefix with camelCase (e.g., `_lib/`, `_components/`, `_data/`)

**Functions:**
- Arrow functions for exports and callbacks: `export const formatCurrency = (value) => { ... }`
- Named functions for React components and hooks: `export default function ComponentName() {}`
- Utility functions: descriptive verb-noun pattern (e.g., `formatCurrency`, `normalizeAccessRules`, `isPatternMatch`, `getAccessToken`, `formatErrorDetail`, `buildUrl`)
- Private helpers: lowercase camelCase (e.g., `resolveAlign`, `formatErrorDetail`)

**Variables:**
- Constants: UPPER_SNAKE_CASE (e.g., `ACCESS_TOKEN_KEY`, `REFRESH_TOKEN_KEY`, `DEFAULT_OUTLET`, `API_BASE_URL`, `PASSWORD_HASH`, `AUTH_KEY`)
- Style/configuration objects: camelCase (e.g., `TONE_STYLES`, `ALIGN_CLASS`, `TYPE_STYLE`, `SIGNAL_STYLE`, `STATUS_STYLE`)
- State variables: camelCase (e.g., `state`, `rules`, `permissions`, `loading`, `error`, `busy`)
- React props: camelCase (e.g., `containerClassName`, `emptyLabel`, `onRowClick`, `tableClassName`)

**Types:**
- Validation schemas: camelCase with Schema suffix (e.g., `analyseRequestSchema` using Zod)
- Lookup objects: UPPER_CASE_IDENTIFIER (e.g., `RETAILER_BY_ID`, `AS_OF_DATE`, `STAGE_LABEL`, `NAV`)

## Code Style

**Formatting:**
- ESLint: `next/core-web-vitals` configuration (`.eslintrc.json`)
- Indentation: 2 spaces (consistent throughout codebase)
- Semicolons: Required at end of statements
- Quotes: Double quotes for strings (`"value"`)
- Trailing commas: Used in multi-line objects/arrays

**Linting:**
- Tool: ESLint with Next.js core-web-vitals preset
- Run command: `npm run lint`
- Configuration file: `.eslintrc.json` (minimal, extends Next.js defaults)

**Bracket Spacing:**
- Objects: spaces inside braces `{ key: value }`
- Function calls: no space before parentheses `foo(arg)`
- Imports: spaces around destructuring `import { Component } from "path"`

## Import Organization

**Order:**
1. React and Next.js built-ins: `import React, { useState } from 'react'`, `import Link from "next/link"`
2. Third-party packages: `import { createContext } from 'react'`, `import { z } from 'zod'`
3. Path aliases (`@/`): `import { apiFetch } from "@/lib/api"`
4. Relative imports: `import { helper } from "../_lib/helper"`
5. CSS/styles: `import "./globals.css"`, `import "leaflet/dist/leaflet.css"`

**Path Aliases:**
- `@/` prefix for root-relative imports throughout codebase
- Examples: `@/lib/api`, `@/components/landing/`, `@/lib/hooks/`
- Configured in Next.js project (implicit, not in `.eslintrc.json`)

**Client Directive:**
- `"use client";` at top of client components before any imports
- Examples: `lib/hooks/useAccessRules.js`, `app/demo/_components/DemoProvider.jsx`
- Not used in server components or utility modules

## Error Handling

**Patterns:**
- API errors use custom Error with properties:
  ```javascript
  const error = new Error(normalizedDetail || fallbackMessage);
  error.status = response.status;
  error.payload = { ...payload };
  throw error;
  ```
- Error detail formatting: `formatErrorDetail()` recursively handles nested structures
- Hook cleanup: `active` flag prevents state updates after unmount
  ```javascript
  let active = true;
  // ... async operation
  return () => { active = false; };
  ```
- Context access: Throws descriptive error if hook used outside provider
  ```javascript
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error('useDemo must be used within DemoProvider');
  ```

**Graceful Defaults:**
- Formatting functions return `"—"` (em dash) for invalid inputs (null, undefined, NaN)
- Fallback messages: "Request failed" when response has no useful payload
- Boolean checks default to `false` when value missing (e.g., `permissionMap.get(code) ?? false`)

## Logging

**Framework:** Native `console` methods only (no logging library)

**Patterns:**
- No centralized logging in utility functions
- Errors propagated with full context to calling code
- State/context tracks execution status and errors (see `DemoProvider`)
- Development info: SHA-256 hashing for demo password validation (not logged)

**Debug Information:**
- Stored in browser state and context, not console
- Execution history tracked in state: `executions` array with wrapper metadata
- Error messages attached to state for UI display

## Comments

**When to Comment:**
- Non-obvious workarounds: `// Fix default marker icons broken by webpack`
- Schema documentation: `// Zod schema for the analyse request`
- Section markers for grouping: `/* ── Orchestrator: where the analysis actually ran ── */`
- Explain "why" not "what"

**Style Guidelines:**
- Avoid over-commenting obvious code
- No JSDoc/TSDoc patterns observed in this codebase
- Single-line comments with `//` preferred

## Function Design

**Size:**
- Keep functions focused and small (3-12 lines typical)
- Examples: `formatCurrency` (4 lines), `buildUrl` (6 lines), `normalizeAccessRules` (7 lines)

**Parameters:**
- Destructure props in React components: `{ children, ttl = 60000 } = {}`
- Options object for related parameters: `{ ttl = 300000 } = {}`
- Default values provided inline

**Return Values:**
- Specific and useful data (never implicit undefined for success)
- Hooks return object with named properties: `{ rules, loading, error }`
- Utility functions return transformed data or boolean

## Module Design

**Exports:**
- Default export for React components: `export default function Home() {}`
- Named exports for utilities: `export function useAccessRules() {}`
- Named exports for constants: `export const apiEndpoints = { ... }`
- Mix allowed: one default + multiple named exports per module

**Module-level State:**
- Token caching: `let memoryTokens = { access: null, refresh: null }` in `auth.js`
- API cache: `const apiCache = new Map()` and `apiInflight = new Map()` in `api.js`
- Theme/data: `const ascend = { ... }` in `_lib/theme.js`

**Barrel Files:**
- Not extensively used
- Single-export files preferred over index.js aggregation

## React-Specific Conventions

**Hooks:**
- Standard hooks: `useState`, `useEffect`, `useContext`, `useMemo`, `useCallback`, `useRef`
- Custom hooks always use `use` prefix
- Expose logical interface (not implementation details)
- Cleanup in `useEffect`: set `active` flag to guard state updates

**Context:**
- Create with `createContext(null)`
- Provider component wraps children
- Custom hook (e.g., `useDemo()`) for consumer access
- Error-check in consumer hook if used outside provider

**Props:**
- Destructure with defaults: `{ emptyLabel = "No records", onRowClick, ... }`
- No PropTypes; destructuring handles validation
- Optional props clearly indicated by defaults

**Components:**
- Client components must declare `"use client"` at top
- Component functions use regular function syntax or arrow functions
- Fragment usage: `<>` for wrapping multiple elements

## Validation

**Schema Validation:**
- Zod library for runtime validation: `import { z } from 'zod'`
- Request schemas defined for API boundaries: `analyseRequestSchema`
- Custom validation functions for complex checks: `isValidAnalysisResponse(json)`

**Null/Undefined Handling:**
- Defensive checks before operations: `if (!value) return "—"`
- Array checks: `Array.isArray(value) ? ... : null`
- Optional chaining rarely used; explicit checks preferred

## Environment Configuration

**Public Environment Variables:**
- `NEXT_PUBLIC_API_BASE_URL` for API endpoint

**Token Management:**
- Stored in sessionStorage with memory cache backup
- Functions: `saveTokens()`, `getAccessToken()`, `clearTokens()`
- JWT parsing: `parseJwt()` extracts payload from token

**Next.js Config:**
- Dynamic rendering: `export const dynamic = "force-dynamic"`
- Cache control: `export const revalidate = 0`, `export const fetchCache = "default-no-store"`

---

*Convention analysis: 2026-07-13*
