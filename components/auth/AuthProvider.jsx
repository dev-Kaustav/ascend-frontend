"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import {
  clearTokens,
  getAccessToken,
  getRoleFromToken,
  getUserFromToken,
  logout as clearAndRedirect,
  subscribeToTokens,
} from "@/lib/auth";

// Auth state, read without ever touching browser storage during render.
//
// "use client" does not mean "browser only" — a client component is still rendered on the
// server to produce the initial HTML. Reading the token during render therefore ran in
// both places: the server has no localStorage and saw null, the browser saw a real token,
// the two renders disagreed, and React threw away the server HTML and rebuilt the tree,
// logging a hydration error on every protected page.
//
// useSyncExternalStore is React's API for exactly this shape of problem: browser state
// that the server cannot see. getServerSnapshot supplies the value used on the server AND
// during hydration, so both agree; React then reads getSnapshot and re-renders with the
// real token as an ordinary update. Doing this with useEffect + setState would work too,
// but it is a cascading render the lint rules correctly flag.
//
// getServerSnapshot returns undefined rather than null so "not read yet" (loading) stays
// distinguishable from "read, nobody is logged in" (anon) — AccessLayout must not redirect
// to /login during hydration just because the token has not been observed yet.

const AuthContext = createContext({
  status: "loading",
  token: null,
  user: null,
  role: null,
  signOut: () => {},
});

const getServerSnapshot = () => undefined;

export function AuthProvider({ children }) {
  // Returns a string or null — primitives, so React's identity check is stable and this
  // cannot loop. Never return a fresh object here.
  const token = useSyncExternalStore(subscribeToTokens, getAccessToken, getServerSnapshot);

  const signOut = useCallback(() => {
    clearTokens();
    clearAndRedirect();
  }, []);

  const value = useMemo(() => {
    const status = token === undefined ? "loading" : token ? "authed" : "anon";
    return {
      status,
      token: token ?? null,
      user: token ? getUserFromToken(token) : null,
      role: token ? getRoleFromToken(token) : null,
      signOut,
    };
  }, [token, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
