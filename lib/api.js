import { getAccessToken, logout } from "@/lib/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";
const apiCache = new Map();
const apiInflight = new Map();

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
    const error = new Error(payload?.detail || "Request failed");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
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
    return;
  }
  const url = buildUrl(path);
  apiCache.delete(url);
}

export const apiEndpoints = {
  auth: {
    login: "/auth/login",
    me: "/auth/me"
  },
  admin: {
    orders: "/admin/orders",
    inventory: "/admin/inventory",
    brands: "/admin/brands",
    retailers: "/admin/retailers",
    salesmen: "/admin/salesmen",
    drivers: "/admin/drivers",
    skus: "/admin/skus",
    warehouses: "/admin/warehouses",
    lookups: "/admin/lookups",
    summary: "/admin/summary",
    orderStatusSummary: "/admin/orders/status-summary",
    accountingPayments: "/accounting/payments",
    accountingCredits: "/accounting/credit-notes",
    users: "/admin/users",
    userActive: (id) => `/admin/users/${id}/active`,
    userRole: (id) => `/admin/users/${id}/role`,
    userGroup: (id) => `/admin/users/${id}/group`,
    userPermissions: (id) => `/admin/users/${id}/permissions`,
    permissions: "/admin/permissions",
    groups: "/admin/groups",
    groupPermissions: (id) => `/admin/groups/${id}/permissions`
  },
  orders: {
    create: "/orders",
    updateStatus: (id) => `/orders/${id}/status`,
    detail: (id) => `/orders/${id}`,
    invoice: (id) => `/orders/${id}/invoice-view`
  },
  brand: {
    dashboard: "/brand/dashboard"
  },
  retailer: {
    dashboard: "/retailer/dashboard",
    orders: "/retailer/orders"
  },
  creditNotes: {
    view: (id) => `/credit-notes/${id}/view`
  }
};
