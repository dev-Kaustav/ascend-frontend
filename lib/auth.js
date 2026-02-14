const ACCESS_TOKEN_KEY = "ascend_access_token";
const REFRESH_TOKEN_KEY = "ascend_refresh_token";

let memoryTokens = {
  access: null,
  refresh: null
};

export function saveTokens({ accessToken, refreshToken }) {
  if (typeof window === "undefined") return;
  memoryTokens = {
    access: accessToken || null,
    refresh: refreshToken || null
  };
  if (accessToken) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  }
  if (refreshToken) {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function getAccessToken() {
  if (memoryTokens.access) return memoryTokens.access;
  if (typeof window === "undefined") return null;
  const stored = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  memoryTokens.access = stored;
  return stored;
}

export function getRefreshToken() {
  if (memoryTokens.refresh) return memoryTokens.refresh;
  if (typeof window === "undefined") return null;
  const stored = sessionStorage.getItem(REFRESH_TOKEN_KEY);
  memoryTokens.refresh = stored;
  return stored;
}

export function clearTokens() {
  memoryTokens = { access: null, refresh: null };
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
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
  if (role) return "/app/dashboard";
  return "/login";
}

export function logout() {
  clearTokens();
  if (typeof window !== "undefined") {
    window.location.assign("/login");
  }
}
