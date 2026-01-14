import { getAccessToken, logout } from "@/lib/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

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

export const apiEndpoints = {
  auth: {
    login: "/auth/login",
    me: "/auth/me"
  },
  admin: {
    orders: "/admin/orders",
    inventory: "/admin/inventory",
    retailers: "/admin/retailers",
    salesmen: "/admin/salesmen",
    skus: "/admin/skus",
    warehouses: "/admin/warehouses",
    accountingPayments: "/accounting/payments",
    accountingCredits: "/accounting/credit-notes"
  },
  orders: {
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
