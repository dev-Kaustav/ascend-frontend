"use client";

import { useEffect, useMemo, useState } from "react";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { toTitleCase } from "@/lib/format";
import { InputBar, SelectBar } from "@/components/ui/InputBars";
import { useToast } from "@/components/ui/ToastProvider";
import { useAuth } from "@/components/auth/AuthProvider";

const ROLE_OPTIONS = ["ADMIN", "ACCOUNTANT", "WAREHOUSE_MANAGER", "SALESMAN", "DRIVER", "BRAND", "RETAILER"];

function getInitials(email) {
  return (
    (email || "U")
      .split("@")[0]
      .split(/[._-]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "U"
  );
}

function getRoleBadgeClass(role) {
  switch (role) {
    case "ADMIN":
      return "bg-slate-900 text-white";
    case "WAREHOUSE_MANAGER":
      return "bg-violet-100 text-violet-700";
    case "ACCOUNTANT":
      return "bg-emerald-100 text-emerald-700";
    case "SALESMAN":
      return "bg-amber-100 text-amber-700";
    case "DRIVER":
      return "bg-sky-100 text-sky-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function AdminUsers({ showHeader = true, showGroupsSection = true, showUsersSection = true } = {}) {
  const { notify } = useToast();
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?.id ? Number(currentUser.id) : null;
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [groupError, setGroupError] = useState("");
  const [saving, setSaving] = useState(false);
  const [groupSaving, setGroupSaving] = useState(false);
  const [roleUpdatingId, setRoleUpdatingId] = useState(null);
  const [groupUpdatingId, setGroupUpdatingId] = useState(null);
  const [activeUpdatingId, setActiveUpdatingId] = useState(null);
  const [passwordSavingId, setPasswordSavingId] = useState(null);
  const [deleteSavingId, setDeleteSavingId] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState("ALL");
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [modalUser, setModalUser] = useState(null);
  const [modalMode, setModalMode] = useState(null);
  const [passwordValue, setPasswordValue] = useState("");
  const [form, setForm] = useState({ email: "", phoneNumber: "", password: "", role: "ACCOUNTANT", groupId: "" });
  // The password mirrors the phone number until an admin types their own, at
  // which point the mirroring stops for the rest of this form.
  const [passwordEdited, setPasswordEdited] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: "", role: "ACCOUNTANT" });

  async function loadData(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const [usersResponse, groupsResponse] = await Promise.all([
        apiFetch(apiEndpoints.admin.users),
        apiFetch(apiEndpoints.admin.groups),
      ]);
      setUsers(usersResponse || []);
      setGroups(groupsResponse || []);
      setError("");
      setGroupError("");
    } catch (err) {
      setError(err?.payload?.detail || err?.message || "Unable to load users.");
      setGroupError(err?.payload?.detail || err?.message || "Unable to load groups.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const groupFilters = useMemo(() => {
    const options = groups
      .map((group) => ({ id: group.id, label: group.name }))
      .sort((left, right) => left.label.localeCompare(right.label));
    return [{ id: "ALL", label: "All groups" }, { id: null, label: "No group" }, ...options];
  }, [groups]);

  // A group carries exactly one role (see docs/access-control.md), and the
  // backend rejects a create whose role and group role disagree. Selecting
  // either side here keeps the pair consistent so that never happens.
  const groupsByRole = useMemo(() => {
    const byRole = new Map();
    groups.forEach((group) => {
      byRole.set(group.role, [...(byRole.get(group.role) || []), group]);
    });
    return byRole;
  }, [groups]);

  function selectRole(role) {
    setForm((current) => {
      // Only auto-select when the role names exactly one group; two candidates
      // is a genuine choice and clearing is the honest answer.
      const matches = groupsByRole.get(role) || [];
      const groupId = matches.length === 1 ? String(matches[0].id) : "";
      return { ...current, role, groupId };
    });
  }

  function selectGroup(groupId) {
    setForm((current) => {
      const group = groups.find((candidate) => String(candidate.id) === groupId);
      return { ...current, groupId, role: group ? group.role : current.role };
    });
  }

  const filteredUsers = useMemo(() => {
    if (selectedGroupId === "ALL") return users;
    if (selectedGroupId === null) return users.filter((user) => !user.group_id);
    return users.filter((user) => user.group_id === selectedGroupId);
  }, [selectedGroupId, users]);

  async function handleCreateUser(event) {
    event.preventDefault();
    const phoneNumber = form.phoneNumber.replace(/\D/g, "");
    if (!form.email.trim() || !form.password || phoneNumber.length !== 10) {
      setError("Username, a 10 digit phone number, and password are required.");
      return;
    }

    setSaving(true);
    try {
      await apiFetch(apiEndpoints.admin.users, {
        method: "POST",
        body: JSON.stringify({
          email: `${form.email.trim().split("@")[0]}@ascendfoods.in`,
          password: form.password,
          role: form.role,
          group_id: form.groupId ? Number(form.groupId) : null,
          phone_number: Number(phoneNumber),
          is_active: true,
        }),
      });
      setForm({ email: "", phoneNumber: "", password: "", role: "ACCOUNTANT", groupId: "" });
      setPasswordEdited(false);
      setShowCreateUserModal(false);
      notify("User created.");
      await loadData(false);
    } catch (err) {
      setError(err?.payload?.detail || err?.message || "Unable to create user.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateGroup(event) {
    event.preventDefault();
    if (!groupForm.name.trim()) {
      setGroupError("Group name is required.");
      return;
    }

    setGroupSaving(true);
    try {
      await apiFetch(apiEndpoints.admin.groups, {
        method: "POST",
        body: JSON.stringify({ name: groupForm.name.trim(), role: groupForm.role }),
      });
      setGroupForm({ name: "", role: "ACCOUNTANT" });
      setShowCreateGroupModal(false);
      notify("Group created.");
      await loadData(false);
    } catch (err) {
      setGroupError(err?.payload?.detail || err?.message || "Unable to create group.");
    } finally {
      setGroupSaving(false);
    }
  }

  async function handleRoleChange(userId, role) {
    setRoleUpdatingId(userId);
    try {
      const response = await apiFetch(apiEndpoints.admin.userRole(userId), {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      setUsers((current) => current.map((user) => (user.id === userId ? { ...user, ...response } : user)));
    } catch (err) {
      setError(err?.payload?.detail || err?.message || "Unable to change role.");
    } finally {
      setRoleUpdatingId(null);
    }
  }

  async function handleGroupChange(userId, groupId) {
    setGroupUpdatingId(userId);
    try {
      const response = await apiFetch(apiEndpoints.admin.userGroup(userId), {
        method: "PATCH",
        body: JSON.stringify({ group_id: groupId }),
      });
      setUsers((current) => current.map((user) => (user.id === userId ? { ...user, ...response } : user)));
    } catch (err) {
      setError(err?.payload?.detail || err?.message || "Unable to update group.");
    } finally {
      setGroupUpdatingId(null);
    }
  }

  async function handleActiveChange(user) {
    setActiveUpdatingId(user.id);
    try {
      const response = await apiFetch(`${apiEndpoints.admin.userActive(user.id)}?is_active=${!user.is_active}`, {
        method: "PATCH",
      });
      setUsers((current) => current.map((entry) => (entry.id === user.id ? { ...entry, ...response } : entry)));
      notify(response.is_active ? "User activated." : "User deactivated.");
    } catch (err) {
      setError(err?.payload?.detail || err?.message || "Unable to update user status.");
    } finally {
      setActiveUpdatingId(null);
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    if (!modalUser || !passwordValue) {
      setError("Enter a new password.");
      return;
    }

    setPasswordSavingId(modalUser.id);
    try {
      await apiFetch(apiEndpoints.admin.userPassword(modalUser.id), {
        method: "PATCH",
        body: JSON.stringify({ password: passwordValue }),
      });
      setModalUser(null);
      setModalMode(null);
      setPasswordValue("");
      notify("Password updated.");
    } catch (err) {
      setError(err?.payload?.detail || err?.message || "Unable to update password.");
    } finally {
      setPasswordSavingId(null);
    }
  }

  async function handleDeleteUser() {
    if (!modalUser) return;
    setDeleteSavingId(modalUser.id);
    try {
      await apiFetch(apiEndpoints.admin.userDelete(modalUser.id), { method: "DELETE" });
      setUsers((current) => current.filter((user) => user.id !== modalUser.id));
      setModalUser(null);
      setModalMode(null);
      notify("User deleted.");
    } catch (err) {
      setError(err?.payload?.detail || err?.message || "Unable to delete user.");
    } finally {
      setDeleteSavingId(null);
    }
  }

  const primaryButtonClass = "inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50";
  const secondaryButtonClass = "inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

  if (loading) {
    return <div className="rounded-[1.5rem] border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.35)]">Loading user management...</div>;
  }

  return (
    <div className="space-y-8 pb-8">
      {showHeader ? (
        <section>
          <h1 className="text-[2.2rem] font-bold tracking-[-0.03em] text-slate-900">User Management</h1>
          <p className="mt-2 text-sm text-slate-600">{users.length} users across {groups.length} groups</p>
        </section>
      ) : null}

      {showGroupsSection ? (
        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-[1.55rem] font-bold tracking-[-0.03em] text-slate-900">Groups</h2>
              <p className="mt-1 text-sm text-slate-600">Named role-assignment bundles.</p>
            </div>
            <button type="button" onClick={() => setShowCreateGroupModal(true)} className={primaryButtonClass}>+ Add Group</button>
          </div>
          {groupError ? <p className="mb-3 text-sm text-rose-500">{groupError}</p> : null}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {groups.map((group) => (
              <article key={group.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900">{group.name}</h3>
                <p className="mt-1 text-xs text-slate-600">{toTitleCase(group.role)}</p>
                <div className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-600">{group.user_count || 0} members</div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {showUsersSection ? (
        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-[1.55rem] font-bold tracking-[-0.03em] text-slate-900">Users</h2>
              <p className="mt-1 text-sm text-slate-600">{filteredUsers.length} users in this view</p>
            </div>
            <button type="button" onClick={() => { setPasswordEdited(false); setShowCreateUserModal(true); }} className={primaryButtonClass}>+ Add User</button>
          </div>
          {error ? <p className="mb-3 text-sm text-rose-500">{error}</p> : null}
          <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
            <div className="border-b border-slate-200/60 bg-white px-8 py-6">
              <div className="flex flex-wrap gap-2.5">
                {groupFilters.map((option) => (
                  <button
                    key={`${option.label}-${option.id === null ? "none" : option.id}`}
                    type="button"
                    onClick={() => setSelectedGroupId(option.id)}
                    className={`cursor-pointer rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${selectedGroupId === option.id ? "bg-[#1a1b2e] text-white shadow-lg shadow-[#1a1b2e]/20" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="divide-y divide-slate-200/60">
              {filteredUsers.map((user) => (
                <div key={user.id} className="px-8 py-6 transition-colors hover:bg-slate-50/50">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex flex-1 items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 text-sm font-bold text-white shadow-lg shadow-purple-500/20">{getInitials(user.email)}</div>
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-sm font-bold text-slate-900">{user.email}</h3>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getRoleBadgeClass(user.role)}`}>{toTitleCase(user.role)}</span>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${user.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{user.is_active ? "Active" : "Inactive"}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">{user.phone_number || "-"}</p>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:w-[360px]">
                      <SelectBar value={user.role} onChange={(event) => handleRoleChange(user.id, event.target.value)} disabled={roleUpdatingId === user.id} size="sm">
                        {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{toTitleCase(role)}</option>)}
                      </SelectBar>
                      <SelectBar value={user.group_id ? String(user.group_id) : ""} onChange={(event) => handleGroupChange(user.id, event.target.value ? Number(event.target.value) : null)} disabled={groupUpdatingId === user.id} size="sm">
                        <option value="">No group</option>
                        {groups.map((group) => <option key={group.id} value={String(group.id)}>{group.name}</option>)}
                      </SelectBar>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => handleActiveChange(user)} disabled={activeUpdatingId === user.id || currentUserId === user.id} className={secondaryButtonClass}>{user.is_active ? "Deactivate" : "Activate"}</button>
                      <button type="button" onClick={() => { setModalUser(user); setModalMode("password"); setPasswordValue(""); }} className={secondaryButtonClass}>Reset Password</button>
                      <button type="button" onClick={() => { setModalUser(user); setModalMode("delete"); }} disabled={currentUserId === user.id} className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50">Delete User</button>
                    </div>
                  </div>
                </div>
              ))}
              {!filteredUsers.length ? <div className="px-8 py-10 text-sm text-slate-400">No users in this group.</div> : null}
            </div>
          </div>
        </section>
      ) : null}

      {showCreateUserModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <div className="w-full max-w-3xl overflow-hidden rounded-[1.75rem] bg-white shadow-2xl">
            <div className="border-b border-slate-200 bg-gradient-to-r from-purple-50 to-white px-8 py-6"><h3 className="text-xl font-bold text-slate-900">Create New User</h3></div>
            <form onSubmit={handleCreateUser} className="space-y-6 px-8 py-6">
              <div className="grid gap-6 md:grid-cols-2">
                <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-700">Username</span><InputBar value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="username" /></label>
                <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-700">Phone Number</span><InputBar inputMode="numeric" maxLength={10} value={form.phoneNumber} onChange={(event) => setForm((current) => { const phoneNumber = event.target.value.replace(/\D/g, "").slice(0, 10); return { ...current, phoneNumber, password: passwordEdited ? current.password : phoneNumber }; })} /></label>
              </div>
              <div className="grid gap-6 md:grid-cols-3">
                <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-700">Password</span><InputBar type="password" value={form.password} onChange={(event) => { setPasswordEdited(true); setForm((current) => ({ ...current, password: event.target.value })); }} /></label>
                <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-700">Role</span><SelectBar value={form.role} onChange={(event) => selectRole(event.target.value)}>{ROLE_OPTIONS.map((role) => <option key={role} value={role}>{toTitleCase(role)}</option>)}</SelectBar></label>
                <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-700">Group</span><SelectBar value={form.groupId} onChange={(event) => selectGroup(event.target.value)}><option value="">No group</option>{groups.map((group) => <option key={group.id} value={String(group.id)}>{group.name}</option>)}</SelectBar></label>
              </div>
              <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowCreateUserModal(false)} className={secondaryButtonClass}>Cancel</button><button type="submit" disabled={saving} className={primaryButtonClass}>{saving ? "Creating..." : "Create User"}</button></div>
            </form>
          </div>
        </div>
      ) : null}

      {showCreateGroupModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-[1.75rem] bg-white shadow-2xl">
            <div className="border-b border-slate-200 bg-gradient-to-r from-purple-50 to-white px-8 py-6"><h3 className="text-xl font-bold text-slate-900">Create Group</h3></div>
            <form onSubmit={handleCreateGroup} className="space-y-6 px-8 py-6">
              <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-700">Name</span><InputBar value={groupForm.name} onChange={(event) => setGroupForm((current) => ({ ...current, name: event.target.value }))} /></label>
              <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-700">Role</span><SelectBar value={groupForm.role} onChange={(event) => setGroupForm((current) => ({ ...current, role: event.target.value }))}>{ROLE_OPTIONS.map((role) => <option key={role} value={role}>{toTitleCase(role)}</option>)}</SelectBar></label>
              <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowCreateGroupModal(false)} className={secondaryButtonClass}>Cancel</button><button type="submit" disabled={groupSaving} className={primaryButtonClass}>{groupSaving ? "Creating..." : "Create Group"}</button></div>
            </form>
          </div>
        </div>
      ) : null}

      {modalUser && modalMode === "password" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-[1.75rem] bg-white shadow-2xl">
            <div className="border-b border-slate-200 bg-gradient-to-r from-purple-50 to-white px-8 py-6"><h3 className="text-xl font-bold text-slate-900">Reset Password</h3><p className="mt-1 text-sm text-slate-600">{modalUser.email}</p></div>
            <form onSubmit={handleResetPassword} className="space-y-6 px-8 py-6"><InputBar type="password" value={passwordValue} onChange={(event) => setPasswordValue(event.target.value)} placeholder="New password" /><div className="flex justify-end gap-3"><button type="button" onClick={() => { setModalUser(null); setModalMode(null); }} className={secondaryButtonClass}>Cancel</button><button type="submit" disabled={passwordSavingId === modalUser.id} className={primaryButtonClass}>{passwordSavingId === modalUser.id ? "Saving..." : "Save Password"}</button></div></form>
          </div>
        </div>
      ) : null}

      {modalUser && modalMode === "delete" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-[1.75rem] bg-white shadow-2xl">
            <div className="border-b border-slate-200 bg-rose-50 px-8 py-6"><h3 className="text-xl font-bold text-slate-900">Delete User</h3><p className="mt-1 text-sm text-slate-600">{modalUser.email}</p></div>
            <div className="space-y-6 px-8 py-6"><p className="text-sm text-slate-600">This user will no longer be able to access the application.</p><div className="flex justify-end gap-3"><button type="button" onClick={() => { setModalUser(null); setModalMode(null); }} className={secondaryButtonClass}>Cancel</button><button type="button" onClick={handleDeleteUser} disabled={deleteSavingId === modalUser.id} className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50">{deleteSavingId === modalUser.id ? "Deleting..." : "Delete User"}</button></div></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
