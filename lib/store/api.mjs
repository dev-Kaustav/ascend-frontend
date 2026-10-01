// Transport for the public storefront and (in later plans) the retailer session.
//
// Deliberately independent of lib/api.js: that module attaches the staff bearer token and
// redirects to /login on 401, neither of which a storefront visitor should ever trigger.
// Nothing here imports from lib/auth.js or lib/api.js.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export const storeEndpoints = {
  products: "/store/products",
  product: (id) => `/store/products/${encodeURIComponent(id)}`,
  categories: "/store/categories",
  brands: "/store/brands"
};

export class StoreApiError extends Error {
  constructor(message, { status = 0, payload = null, retryAfter = null } = {}) {
    super(message);
    this.name = "StoreApiError";
    this.status = status;
    // The whole parsed body is kept: 409 STOCK_CHANGED carries top-level code/items, while
    // other errors nest detail, so callers need the raw shape rather than a flattened string.
    this.payload = payload;
    this.retryAfter = retryAfter;
  }
}

function buildUrl(path) {
  if (path.startsWith("http")) return path;
  const base = API_BASE_URL.endsWith("/") ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * options.public: true sends no Authorization header whatever else is passed, so an anonymous
 *   catalogue read can never carry (or be cached against) a retailer identity.
 * options.token: retailer bearer, honoured only when options.public is not set.
 * Every request is no-store: the response varies by Authorization and must not be shared.
 */
export async function storeFetch(path, options = {}) {
  const { public: isPublic = false, token, headers: extraHeaders, ...init } = options;
  const headers = new Headers(extraHeaders || {});
  if (!isPublic && token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response;
  try {
    response = await fetch(buildUrl(path), { ...init, headers, cache: "no-store" });
  } catch (cause) {
    throw new StoreApiError("Network error", { payload: { cause: String(cause?.message || cause) } });
  }

  if (response.status === 204) return null;

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const detail = payload && typeof payload === "object" ? payload.detail : null;
    throw new StoreApiError(typeof detail === "string" ? detail : `Request failed (${response.status})`, {
      status: response.status,
      payload,
      retryAfter: response.headers.get("retry-after")
    });
  }
  return payload;
}
