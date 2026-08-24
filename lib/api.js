import { getAccessToken, logout } from "@/lib/auth";

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

export async function apiFetch(path, options = {}) {
  const url = buildUrl(path);
  const headers = new Headers(options.headers || {});
  const token = getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include"
  });

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
  const headers = new Headers(options.headers || {});
  const token = getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include"
  });

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
    me: "/auth/me",
    changePassword: "/auth/me/password"
  },
  admin: {
    orders: "/admin/orders",
    ordersExport: "/admin/orders/export",
    inventory: "/admin/inventory",
    brands: "/admin/brands",
    retailers: "/admin/retailers",
    salesmen: "/admin/salesmen",
    drivers: "/admin/drivers",
    skus: "/admin/skus",
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
