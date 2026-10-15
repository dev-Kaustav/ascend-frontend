"use client";

import { useEffect, useState } from "react";
import { apiEndpoints, apiFetch } from "@/lib/api";
import SectionCard from "@/components/layout/SectionCard";
import { InputBar } from "@/components/ui/InputBars";
import { useToast } from "@/components/ui/ToastProvider";
import { toTitleCase } from "@/lib/format";
import { logout } from "@/lib/auth";

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { notify } = useToast();

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      try {
        const response = await apiFetch(apiEndpoints.auth.me);
        if (!active) return;
        setUser(response);
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Unable to load profile.");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadProfile();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!currentPassword || !newPassword) {
      setError("Enter your current and new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    setSaving(true);
    try {
      await apiFetch(apiEndpoints.auth.changePassword, {
        method: "PATCH",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      // The change signs out every session including this one — the tokens in hand are
      // already dead server-side, so drop them and go to the login screen rather than
      // letting the next request fail with a 401 out of nowhere.
      notify("Password updated. Sign in again with your new password.");
      logout();
    } catch (err) {
      setError(err?.payload?.detail || err?.message || "Unable to update password.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
        Loading profile…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard title="Profile" subtitle="Manage your account settings.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            <p className="text-xs uppercase tracking-widest text-slate-400">Email</p>
            <p className="mt-2 font-semibold text-slate-900">{user?.email || "-"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            <p className="text-xs uppercase tracking-widest text-slate-400">Role</p>
            <p className="mt-2 font-semibold text-slate-900">{toTitleCase(user?.role || "") || "-"}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Change Password" subtitle="Update your sign-in password.">
        <form onSubmit={handleSubmit} className="grid gap-4 md:max-w-xl">
          <InputBar
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            placeholder="Current password"
          />
          <InputBar
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="New password"
          />
          <InputBar
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Confirm new password"
          />
          {error ? <p className="text-sm text-rose-500">{error}</p> : null}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Update Password"}
            </button>
          </div>
        </form>
      </SectionCard>
      <div className="lg:hidden">
        <button type="button" onClick={logout} className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-base font-semibold text-slate-700">Sign out</button>
      </div>
    </div>
  );
}
