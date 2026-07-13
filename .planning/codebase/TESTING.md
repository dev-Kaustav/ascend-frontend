# Testing Patterns

**Analysis Date:** 2026-07-13

## Test Framework

**Status:** Not currently implemented in main codebase

**Observations:**
- No Jest, Vitest, or testing framework configured in `package.json`
- No test files found in application code (checked `app/`, `lib/`, `components/`)
- No test configuration files (`jest.config.js`, `vitest.config.js`, `.test.js`, `.spec.js` files)
- ESLint configured but does not include testing linters

**Recommendation:**
- When implementing tests, adopt Vitest (modern, fast, ESM-compatible) or Jest
- Add test scripts to `package.json`

## Test Approach (Current Patterns)

While formal tests are not present, the codebase uses several patterns that support testability:

### Validation via Zod Schemas

**Location:** `app/demo/_lib/validation.js`

Runtime validation provides a form of contract testing:
```javascript
export const analyseRequestSchema = z.object({
  event: z.literal('ANALYSE_REORDER_OPPORTUNITIES'),
  mode: z.enum(['live', 'simulation']),
  executionId: z.string().min(3),
  outletId: z.string().min(1),
  asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export function isValidAnalysisResponse(json) {
  return !!(json && json.retailer && json.recommendation && json.basket && Array.isArray(json.basket.items));
}
```

**Testing approach:**
- Validate request/response shapes at runtime
- If adopting unit tests, reuse Zod schemas for fixture generation

### Utility Functions (Easily Testable)

**Location:** `lib/format.js`, `lib/orders.js`

Pure utility functions ideal for unit testing:
- `formatCurrency(value)` - currency formatting with edge cases
- `formatNumber(value)` - number formatting with locale awareness
- `formatDate(value)` - date string formatting
- `roundToTwo(value)` - decimal rounding with precision
- `getSkuGstRate(sku)` - tax calculation
- `getLineDiscountPercent(item)` - discount percentage calculation

**Testing considerations:**
- Edge cases: null, undefined, NaN, empty values
- Format consistency: locale (en-IN) adherence
- Math precision: rounding errors in financial calculations

### API Layer Testing

**Location:** `lib/api.js`

Current approach uses real fetch calls with error handling:
- `apiFetch(path, options)` - main API call with auth
- `apiFetchBlob(path, options)` - file download handling
- `apiFetchCached(path, { ttl })` - caching with TTL and request deduplication

**Testing approach for future:**
- Mock fetch for error scenarios (401, 500, network errors)
- Verify error normalization: `formatErrorDetail()` handles nested structures
- Test cache invalidation: `invalidateApiCache(path)`
- Verify request deduplication with `apiInflight` Map

### React Hooks (Observable Behavior)

**Location:** `lib/hooks/useAccessRules.js`, `lib/hooks/usePermissions.js`, `lib/hooks/useLineItems.js`

Hooks follow consistent pattern:
```javascript
export default function useAccessRules({ ttl = 60000 } = {}) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiFetchCached(apiEndpoints.auth.accessRules, { ttl })
      .then((data) => {
        if (!active) return;
        setRules(normalizeAccessRules(data || []));
        setError("");
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setRules([]);
        setError(err?.message || "Unable to load access rules.");
        setLoading(false);
      });
    return () => { active = false; };
  }, [ttl]);

  return { rules, loading, error };
}
```

**Testing approach for future:**
- Mock API responses with `apiFetchCached`
- Verify state transitions: loading → success/error
- Test cleanup flag prevents race conditions
- Test TTL cache expiration

### Context & State Management

**Location:** `app/demo/_components/DemoProvider.jsx`

Comprehensive state provider with callbacks:
- Tracks: `state`, `mode`, `stage`, `retailer`, `analysis`, `basket`, `error`, `busy`, `executions`
- Actions: `patch()`, `setMode()`, `reset()`, `selectRetailer()`, `runAnalysis()`, `setQuantity()`, `approve()`
- Memoized: `basketValue` calculation, `recommendation` derivation

**Testing approach for future:**
```javascript
// Example unit test pattern (Vitest):
describe('DemoProvider', () => {
  it('should initialize with default state', () => {
    const { result } = renderHook(() => useDemo(), {
      wrapper: DemoProvider
    });
    expect(result.current.mode).toBe('simulation');
    expect(result.current.stage).toBe('READY');
  });

  it('should update retailer and reset analysis on selectRetailer', () => {
    const { result } = renderHook(() => useDemo(), {
      wrapper: DemoProvider
    });
    act(() => {
      result.current.selectRetailer('RET-1027');
    });
    expect(result.current.retailer).toBeDefined();
    expect(result.current.analysis).toBeNull();
  });
});
```

## Test File Organization (Recommended)

**Location:**
- Co-locate test files next to source code
- Naming: `ComponentName.test.jsx`, `utility.test.js`

**Directory structure:**
```
lib/
├── api.js
├── api.test.js                # API client tests
├── format.js
├── format.test.js             # Formatter tests
└── hooks/
    ├── useAccessRules.js
    └── useAccessRules.test.js # Hook tests

components/
├── ui/
│   ├── ToastProvider.jsx
│   └── ToastProvider.test.jsx # Component tests
└── tables/
    ├── DataTable.jsx
    └── DataTable.test.jsx
```

## Test Structure (Recommended Pattern)

**Based on existing code patterns:**

```javascript
// Example: format.test.js
import { describe, it, expect } from 'vitest';
import { formatCurrency, formatNumber, formatDate, roundToTwo } from './format';

describe('Format Utilities', () => {
  describe('formatCurrency', () => {
    it('should format valid numbers with INR locale', () => {
      expect(formatCurrency(1000)).toBe('₹1,000.00');
      expect(formatCurrency(1000.5)).toBe('₹1,000.50');
    });

    it('should return em dash for null/undefined/NaN', () => {
      expect(formatCurrency(null)).toBe('—');
      expect(formatCurrency(undefined)).toBe('—');
      expect(formatCurrency(NaN)).toBe('—');
    });
  });

  describe('roundToTwo', () => {
    it('should round to 2 decimal places', () => {
      expect(roundToTwo(1.005)).toBe(1.01);
      expect(roundToTwo(1.004)).toBe(1.00);
    });

    it('should handle floating point precision', () => {
      expect(roundToTwo(0.1 + 0.2)).toBe(0.30);
    });
  });
});
```

## Mocking Strategy (Recommended)

**For API Calls:**
```javascript
// Mock apiFetch and apiFetchCached
vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
  apiFetchCached: vi.fn(),
  invalidateApiCache: vi.fn(),
}));
```

**For Context Providers:**
```javascript
// Create test wrapper for hook tests
function TestWrapper({ children }) {
  return <DemoProvider>{children}</DemoProvider>;
}
```

**What to Mock:**
- External API calls (use fixture data or msw if available)
- Browser APIs: `sessionStorage`, `fetch` (when testing auth module)
- Third-party packages: `sonner`, `react-leaflet` (when not testing UI directly)

**What NOT to Mock:**
- Utility functions you're testing directly
- React built-ins (`useState`, `useEffect`, `useContext`)
- Zod validation (test with real schemas)

## Coverage Goals (Recommended)

**Priority order:**
1. **Utility functions** (format.js, orders.js, auth.js)
   - Edge cases for financial calculations
   - Date/number formatting with various locales
   - Auth token parsing and validation

2. **API layer** (api.js)
   - Error handling and normalization
   - Cache behavior and TTL
   - Request deduplication

3. **Hooks** (lib/hooks/*.js)
   - Data loading and error states
   - Cleanup on unmount
   - Dependency changes

4. **Components** (if adopting snapshot testing)
   - Integration tests for complex components (`DemoProvider`, `DataTable`)
   - User interaction flows

**Target:** 70%+ coverage for utility/API, 50%+ for hooks/components

## Common Patterns to Test

**Error Normalization (from `lib/api.js`):**
```javascript
it('should normalize nested error details', () => {
  const detail = {
    msg: 'Validation error',
    loc: ['field', 'subfield']
  };
  expect(formatErrorDetail(detail)).toBe('field.subfield: Validation error');
});
```

**Async State Management (from hooks):**
```javascript
it('should handle loading, success, and error states', async () => {
  const { result } = renderHook(() => useAccessRules());
  
  expect(result.current.loading).toBe(true);
  
  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });
  
  expect(result.current.error).toBe('');
});
```

**Cache Behavior:**
```javascript
it('should reuse cached data within TTL', async () => {
  const mockFetch = vi.spyOn(api, 'apiFetch');
  
  await apiFetchCached('/path', { ttl: 60000 });
  await apiFetchCached('/path', { ttl: 60000 });
  
  expect(mockFetch).toHaveBeenCalledOnce();
});
```

## Running Tests (When Implemented)

**Recommended setup:**
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

**Add to package.json:**
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest watch",
    "test:coverage": "vitest run --coverage"
  }
}
```

**Vitest config:** `vitest.config.js`
```javascript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
  },
});
```

## Testing Best Practices

**Code Testability:**
- Keep utility functions pure (same input = same output)
- Separate side effects (API calls, storage) into dedicated modules
- Use dependency injection or context for configuration
- Avoid coupling to implementation details

**Test Maintainability:**
- One concept per test
- Clear test names describing behavior, not implementation
- Share setup in `beforeEach` only when truly common
- Use fixtures for complex test data (leverage Zod schemas)

**Debugging Tests:**
- Use `screen.debug()` to inspect rendered output
- Check error messages from Zod validation
- Mock at module level, not component level when possible

---

*Testing analysis: 2026-07-13*
