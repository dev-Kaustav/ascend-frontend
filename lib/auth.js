const ACCESS_TOKEN_KEY = "ascend_access_token";
const REFRESH_TOKEN_KEY = "ascend_refresh_token";

// localStorage, not sessionStorage: sessionStorage is scoped to a single tab and is wiped
// when it closes. Field staff work from a phone and switch to Maps or WhatsApp constantly;
// a backgrounded tab is routinely evicted under memory pressure, which took the session
// with it and dropped a driver back at the login screen mid-round.
let storage = null;
function getStorage() {
  if (typeof window === "undefined") return null;
  if (storage) return storage;
  try {
    storage = window.localStorage;
    // Touch it: Safari private mode exposes localStorage but throws on write.
    storage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    storage = null;
  }
  return storage;
}

let memoryTokens = {
  access: null,
  refresh: null
};

// localStorage is shared across tabs, so a refresh in one tab leaves every other tab
// holding a stale token in memory. Drop the cache when another tab writes.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === ACCESS_TOKEN_KEY || event.key === REFRESH_TOKEN_KEY) {
      memoryTokens = { access: null, refresh: null };
      notifyTokenChange();
    }
  });
}

// Subscribers for same-tab token changes (login, logout, refresh). The `storage` event
// only fires in *other* tabs, so React needs its own signal for this one.
const tokenListeners = new Set();

export function subscribeToTokens(listener) {
  tokenListeners.add(listener);
  return () => tokenListeners.delete(listener);
}

function notifyTokenChange() {
  for (const listener of tokenListeners) listener();
}

export function saveTokens({ accessToken, refreshToken }) {
  if (typeof window === "undefined") return;
  memoryTokens = {
    access: accessToken || null,
    refresh: refreshToken || null
  };
  const store = getStorage();
  if (!store) return;
  try {
    if (accessToken) store.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) store.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } catch {
    // Storage full or blocked — the in-memory copy still carries this tab's session.
  }
  notifyTokenChange();
}

function readToken(key, cacheKey) {
  if (memoryTokens[cacheKey]) return memoryTokens[cacheKey];
  const store = getStorage();
  if (!store) return null;
  const stored = store.getItem(key);
  memoryTokens[cacheKey] = stored;
  return stored;
}

export function getAccessToken() {
  return readToken(ACCESS_TOKEN_KEY, "access");
}

export function getRefreshToken() {
  return readToken(REFRESH_TOKEN_KEY, "refresh");
}

export function clearTokens() {
  memoryTokens = { access: null, refresh: null };
  const store = getStorage();
  if (store) {
    store.removeItem(ACCESS_TOKEN_KEY);
    store.removeItem(REFRESH_TOKEN_KEY);
  }
  notifyTokenChange();
}

export function parseJwt(token) {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch (error) {
    return null;
  }
}

// `exp` is seconds since epoch. The skew allows for a token that expires while a request
// is in flight, so it is refreshed before it is used rather than after it 401s.
export function isTokenExpired(token, skewSeconds = 30) {
  const payload = parseJwt(token);
  if (!payload?.exp) return false;
  return payload.exp * 1000 <= Date.now() + skewSeconds * 1000;
}

export function getRoleFromToken(token) {
  const payload = parseJwt(token);
  return payload?.role || null;
}

export function getUserFromToken(token) {
  const payload = parseJwt(token);
  if (!payload) return null;
  return {
    id: payload.user_id || payload.sub || null,
    email: payload.email || null,
    role: payload.role || null
  };
}

export function getDashboardPathForRole(role) {
  // Every signed-in role lands on the dashboard. Drivers used to be routed straight to
  // Outlet Finder, which meant the one screen built for them was only reachable through
  // the nav. Outlet Finder is still in their nav and still a valid destination.
  if (role) return "/app/dashboard";
  return "/login";
}

export function logout() {
  clearTokens();
  if (typeof window !== "undefined") {
    window.location.assign("/login");
  }
}
