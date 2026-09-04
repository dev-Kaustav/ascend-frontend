import { getAccessToken, getRefreshToken, isTokenExpired, logout, saveTokens } from "@/lib/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";
const apiCache = new Map();
const apiInflight = new Map();

function formatErrorDetail(detail) {
  if (!detail) return "";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const parts = detail.map((item) => formatErrorDetail(item)).filter(Boolean);
    return parts.join("; ");
  }
  if (typeof detail === "object") {
    if (detail.msg) {
      const loc = Array.isArray(detail.loc) ? detail.loc.join(".") : detail.loc;
      return loc ? `${loc}: ${detail.msg}` : detail.msg;
    }
    try {
      return JSON.stringify(detail);
    } catch {
      return String(detail);
    }
  }
  return String(detail);
}

function buildUrl(path) {
  if (!path) return API_BASE_URL;
  if (path.startsWith("http")) return path;
  if (!API_BASE_URL) return path;
  const base = API_BASE_URL.endsWith("/") ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

// The refresh token was saved at login and never used: any 401 called logout(), so the
// effective session was one access-token lifetime (60 minutes) regardless of the 7-day
// refresh token. A driver mid-round was signed out and had to log in at the shop counter.
//
// Single-flight: a dashboard fires several requests at once and they all 401 together.
// Without one shared promise that is N concurrent refreshes racing each other.
let refreshInFlight = null;

async function refreshAccessToken() {
  if (refreshInFlight) return refreshInFlight;

  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  refreshInFlight = (async () => {
    try {
      // Raw fetch, deliberately not apiFetch: routing this through the wrapper below
      // would make a failing refresh recurse into itself.
      const response = await fetch(buildUrl(apiEndpoints.auth.refresh), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
        credentials: "include"
      });
      if (!response.ok) return null;
      const data = await response.json();
      if (!data?.access_token) return null;
      saveTokens({ accessToken: data.access_token, refreshToken: data.refresh_token });
      return data.access_token;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

// Endpoints that must never trigger the refresh-and-retry path: a 401 from these means
// the credentials themselves are bad, and retrying would loop.
function isAuthEndpoint(path) {
  return typeof path === "string"
    && (path.includes(apiEndpoints.auth.login) || path.includes(apiEndpoints.auth.refresh));
}

// Ensure a usable access token before a request goes out. Without this, reopening the app
// after the token expired shows an error on the first screen and only recovers afterwards.
async function ensureFreshToken(path) {
  if (isAuthEndpoint(path)) return;
  const token = getAccessToken();
  if (token && isTokenExpired(token) && getRefreshToken()) {
    await refreshAccessToken();
  }
}

export async function apiFetch(path, options = {}) {
  const url = buildUrl(path);

  function send() {
    const headers = new Headers(options.headers || {});
    const token = getAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    return fetch(url, { ...options, headers, credentials: "include" });
  }

  await ensureFreshToken(path);
  let response = await send();

  // One retry only. If the refresh itself fails, or the replayed request 401s again, fall
  // through to the logout below — a second attempt would just loop.
  if (response.status === 401 && !isAuthEndpoint(path)) {
    const refreshed = await refreshAccessToken();
    if (refreshed) response = await send();
  }

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    if (response.status === 401) {
      logout();
    }
    const normalizedDetail = formatErrorDetail(payload?.detail);
    const fallbackMessage = typeof payload === "string" && payload.trim() ? payload : "Request failed";
    const error = new Error(normalizedDetail || fallbackMessage);
    error.status = response.status;
    if (payload && typeof payload === "object") {
      error.payload = { ...payload, detail: normalizedDetail || payload.detail };
    } else {
      error.payload = payload;
    }
    throw error;
  }
  return payload;
}

export async function apiFetchBlob(path, options = {}) {
  const url = buildUrl(path);

  function send() {
    const headers = new Headers(options.headers || {});
    const token = getAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return fetch(url, { ...options, headers, credentials: "include" });
  }

  await ensureFreshToken(path);
  let response = await send();

  if (response.status === 401 && !isAuthEndpoint(path)) {
    const refreshed = await refreshAccessToken();
    if (refreshed) response = await send();
  }

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const payload = isJson ? await response.json() : await response.text();
    if (response.status === 401) {
      logout();
    }
    const normalizedDetail = formatErrorDetail(payload?.detail);
    const fallbackMessage = typeof payload === "string" && payload.trim() ? payload : "Request failed";
    const error = new Error(normalizedDetail || fallbackMessage);
    error.status = response.status;
    if (payload && typeof payload === "object") {
      error.payload = { ...payload, detail: normalizedDetail || payload.detail };
    } else {
      error.payload = payload;
    }
    throw error;
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match ? match[1] : "download";
  return { blob, filename };
}

export async function apiFetchCached(path, { ttl = 300000 } = {}) {
  if (typeof window === "undefined") {
    return apiFetch(path);
  }
  const url = buildUrl(path);
  const cached = apiCache.get(url);
  const now = Date.now();
  if (cached && now - cached.timestamp < ttl) {
    return cached.data;
  }
  if (apiInflight.has(url)) {
    return apiInflight.get(url);
  }
  const request = apiFetch(path)
    .then((data) => {
      apiCache.set(url, { data, timestamp: Date.now() });
      apiInflight.delete(url);
      return data;
    })
    .catch((error) => {
      apiInflight.delete(url);
      throw error;
    });
  apiInflight.set(url, request);
  return request;
}

export function invalidateApiCache(path) {
  if (!path) {
    apiCache.clear();
    apiInflight.clear();
    return;
  }
  const url = buildUrl(path);
  apiCache.delete(url);
  apiInflight.delete(url);
}

export const apiEndpoints = {
  auth: {
    login: "/auth/login",
    refresh: "/auth/refresh",
    me: "/auth/me",
    changePassword: "/auth/me/password"
  },
  admin: {
    orders: "/admin/orders",
    ordersExport: "/admin/orders/export",
    inventory: "/admin/inventory",
    brands: "/admin/brands",
    brandUpdate: (id) => `/admin/brands/${id}`,
    retailers: "/admin/retailers",
    retailerUpdate: (id) => `/admin/retailers/${id}`,
    salesmen: "/admin/salesmen",
    drivers: "/admin/drivers",
    skus: "/admin/skus",
    skuUpdate: (id) => `/admin/skus/${id}`,
    warehouses: "/admin/warehouses",
    companyProfile: "/admin/company-profile",
    lookups: "/admin/lookups",
    summary: "/admin/summary",
    orderStatusSummary: "/admin/orders/status-summary",
    beats: "/admin/beats",
    accountingPayments: "/accounting/payments",
    accountingCredits: "/accounting/credit-notes",
    users: "/admin/users",
    userPassword: (id) => `/admin/users/${id}/password`,
    userDelete: (id) => `/admin/users/${id}`,
    userActive: (id) => `/admin/users/${id}/active`,
    userRole: (id) => `/admin/users/${id}/role`,
    userGroup: (id) => `/admin/users/${id}/group`,
    groups: "/admin/groups",
    outstanding: "/accounting/outstanding",
    outstandingSummary: "/accounting/outstanding/summary",
    collections: "/accounting/collections",
    collectionsSummary: "/accounting/collections/summary",
    paymentsMulti: "/accounting/payments/multi",
    dailySales: "/dashboard/daily-sales",
    salesmanPerformance: "/dashboard/salesman-performance",
  },
  dashboard: {
    dailySales: "/dashboard/daily-sales",
    salesmanPerformance: "/dashboard/salesman-performance",
    coverage: "/dashboard/coverage"
  },
  orders: {
    list: "/orders",
    create: "/orders",
    lookups: "/orders/lookups",
    updateStatus: (id) => `/orders/${id}/status`,
    detail: (id) => `/orders/${id}`,
    invoice: (id) => `/orders/${id}/invoice-view`,
    invoicePdf: (id) => `/orders/${id}/invoice.pdf`,
  },
  imports: {
    upload: "/imports",
    dailySales: "/imports/daily-sales",
    template: "/imports/template",
  },
  brand: {
    dashboard: "/brand/dashboard"
  },
  creditNotes: {
    view: (id) => `/credit-notes/${id}/view`
  },
  billLabels: {
    list: "/bill-labels",
    create: "/bill-labels",
    detail: (id) => `/bill-labels/${id}`,
    update: (id) => `/bill-labels/${id}`,
    delete: (id) => `/bill-labels/${id}`
  },
  outletFinder: {
    retailersLookup: "/outlet-finder/retailers/lookup",
    deliveriesMark: "/outlet-finder/deliveries/mark",
    assignments: "/outlet-finder/assignments",
    assignmentsMine: "/outlet-finder/assignments/mine",
    assignmentAccept: (id) => `/outlet-finder/assignments/${id}/accept`,
  },
};
