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
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#14b8a6_0%,transparent_55%)] opacity-60" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,#f97316_0%,transparent_55%)] opacity-30" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-12">
        <div className="grid w-full gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="flex flex-col justify-center gap-6">
            <p className="text-xs uppercase tracking-[0.5em] text-white/60">Ascend Foods</p>
            <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
              GTM distribution, synced across brands, warehouses, and retail.
            </h1>
            <p className="max-w-xl text-sm text-white/70">
              Login to monitor order velocity, inventory exposure, payment cycles, and on-ground GTM performance.
            </p>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2">Ops-ready dashboards</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2">Role-based access</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2">Realtime reporting</span>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_30px_80px_-60px_rgba(15,23,42,0.8)] backdrop-blur">
            <h2 className="text-xl font-semibold">Sign in</h2>
            <p className="mt-2 text-xs text-white/60">Use your Ascend credentials.</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="text-xs uppercase tracking-widest text-white/60">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="mt-2 w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-emerald-300 focus:outline-none"
                  placeholder="you@ascendfoods.in"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-white/60">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="mt-2 w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-emerald-300 focus:outline-none"
                  placeholder="••••••••"
                />
              </div>
              {error ? <p className="text-sm text-rose-300">{error}</p> : null}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
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
