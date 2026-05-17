"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { getAccessToken, getDashboardPathForRole, getRoleFromToken, saveTokens } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      const role = getRoleFromToken(token);
      router.replace(getDashboardPathForRole(role));
    }
  }, [router]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await apiFetch(apiEndpoints.auth.login, {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      saveTokens({
        accessToken: response.access_token,
        refreshToken: response.refresh_token
      });
      const role = getRoleFromToken(response.access_token);
      router.replace(getDashboardPathForRole(role));
    } catch (err) {
      setError(err?.payload?.detail || "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-night text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(124,77,255,0.35)_0,_rgba(11,6,20,0.65)_45%,_#0b0614_100%)]" />
      <div className="absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(124,77,255,0.4)_0,_rgba(124,77,255,0.18)_45%,_rgba(124,77,255,0)_70%)]" />
      <div className="absolute bottom-10 right-10 h-48 w-48 rounded-full bg-[radial-gradient(circle,_rgba(217,70,239,0.35)_0,_rgba(217,70,239,0.12)_55%,_rgba(217,70,239,0)_70%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-12">
        <div className="grid w-full gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="flex flex-col justify-center gap-6">
            <p className="text-xs uppercase tracking-[0.5em] text-white/60">Ascend Foods</p>
            <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
              Data-driven GTM visibility, in one ops-ready view.
            </h1>
            <p className="max-w-xl text-sm text-white/70">
              Sign in to align warehouse movement, distributor billing, and retail execution across your network.
            </p>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2">Ops-ready dashboards</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2">Role-based access</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2">Realtime reporting</span>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/95 p-8 text-slate-900 shadow-[0_30px_80px_-60px_rgba(15,23,42,0.8)] backdrop-blur">
            <h2 className="text-xl font-semibold">Sign in</h2>
            <p className="mt-2 text-xs text-slate-500">Use your Ascend credentials.</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="text-xs uppercase tracking-widest text-slate-400">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent focus:outline-none"
                  placeholder="you@ascendfoods.in"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-slate-400">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent focus:outline-none"
                  placeholder="••••••••"
                />
              </div>
              {error ? <p className="text-sm text-rose-500">{error}</p> : null}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white shadow-[0_20px_40px_-24px_rgba(124,77,255,0.6)] transition hover:-translate-y-0.5 hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
