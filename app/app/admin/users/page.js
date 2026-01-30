"use client";

import { useEffect, useMemo, useState } from "react";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { toTitleCase, formatDate } from "@/lib/format";
import SectionCard from "@/components/layout/SectionCard";
import DataTable from "@/components/tables/DataTable";
import { InputBar, SelectBar } from "@/components/ui/InputBars";

export default function AdminUsers() {
  const emailDomain = "ascendgoods.in";
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [form, setForm] = useState({ email: "", phoneNumber: "", password: "", role: "ACCOUNTANT", groupId: "" });
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [roleUpdatingId, setRoleUpdatingId] = useState(null);
  const [groupUpdatingId, setGroupUpdatingId] = useState(null);
  const [groupForm, setGroupForm] = useState({ name: "", role: "ACCOUNTANT" });
  const [groupSaving, setGroupSaving] = useState(false);
  const [pendingGroupChanges, setPendingGroupChanges] = useState([]);
  const [pendingUserChanges, setPendingUserChanges] = useState([]);
  const [groupApplySaving, setGroupApplySaving] = useState(false);
  const [userApplySaving, setUserApplySaving] = useState(false);
  const [groupApplyError, setGroupApplyError] = useState("");
  const [userApplyError, setUserApplyError] = useState("");
  const [error, setError] = useState("");
  const [groupError, setGroupError] = useState("");
  const [createMode, setCreateMode] = useState("user");
  const [selectedGroupId, setSelectedGroupId] = useState("ALL");

  const primaryButtonClass = "h-11 rounded-full bg-slate-900 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50";
  const pillButtonClass = "h-11 rounded-full px-4 text-sm font-semibold";

  async function loadData(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const [usersResponse, permsResponse, groupsResponse] = await Promise.all([
        apiFetch(apiEndpoints.admin.users),
        apiFetch(apiEndpoints.admin.permissions),
        apiFetch(apiEndpoints.admin.groups)
      ]);
      setUsers(usersResponse || []);
      setPermissions(permsResponse || []);
      setGroups(groupsResponse || []);
      setError("");
      setGroupError("");
      setGroupApplyError("");
      setUserApplyError("");
    } catch (err) {
      setError(err?.message || "Unable to load users.");
      setGroupError(err?.message || "Unable to load groups.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    setError("");
    const emailLocal = form.email.trim();
    const phoneDigits = form.phoneNumber.replace(/\D/g, "");
    if (!emailLocal || !form.password || !phoneDigits) {
      setError("Username, phone number, and password are required.");
      return;
    }
    if (phoneDigits.length !== 10) {
      setError("Phone number must be 10 digits.");
      return;
    }
    const email = `${emailLocal}@${emailDomain}`;
    setSaving(true);
    try {
      await apiFetch(apiEndpoints.admin.users, {
        method: "POST",
        body: JSON.stringify({
          email,
          password: form.password,
          role: form.role,
          group_id: form.groupId ? Number(form.groupId) : null,
          phone_number: Number(phoneDigits),
          is_active: true
        })
      });
      setForm({ email: "", phoneNumber: "", password: "", role: "ACCOUNTANT", groupId: "" });
      await loadData(false);
    } catch (err) {
      setError(err?.payload?.detail || err?.message || "Unable to create user.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(userId, nextState) {
    setTogglingId(userId);
    setError("");
    try {
      const response = await apiFetch(`${apiEndpoints.admin.userActive(userId)}?is_active=${nextState}`, {
        method: "PATCH"
      });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...response } : u)));
    } catch (err) {
      setError(err?.payload?.detail || err?.message || "Unable to update user.");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleRoleChange(userId, role) {
    setRoleUpdatingId(userId);
    setError("");
    try {
      const response = await apiFetch(apiEndpoints.admin.userRole(userId), {
        method: "PATCH",
        body: JSON.stringify({ role })
      });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...response } : u)));
    } catch (err) {
      setError(err?.payload?.detail || err?.message || "Unable to change role.");
    } finally {
      setRoleUpdatingId(null);
    }
  }

  async function handlePermissionToggle(userId, code, nextState) {
    setError("");
    setUserApplyError("");
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              permissions: [
                ...(u.permissions || []).filter((p) => p.code !== code),
                { code, is_allowed: nextState }
              ]
            }
          : u
      )
    );
    setPendingUserChanges((prev) => {
      const filtered = prev.filter((c) => !(c.type === "user" && c.id === userId && c.code === code));
      return [...filtered, { type: "user", id: userId, code, is_allowed: nextState }];
    });
  }

  async function handleUserGroupChange(userId, groupIdValue) {
    setGroupUpdatingId(userId);
    setError("");
    try {
      const response = await apiFetch(apiEndpoints.admin.userGroup(userId), {
        method: "PATCH",
        body: JSON.stringify({ group_id: groupIdValue })
      });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...response } : u)));
    } catch (err) {
      setError(err?.payload?.detail || err?.message || "Unable to update group.");
    } finally {
      setGroupUpdatingId(null);
    }
  }

  async function handleCreateGroup(event) {
    event.preventDefault();
    setGroupError("");
    if (!groupForm.name) {
      setGroupError("Group name is required.");
      return;
    }
    setGroupSaving(true);
    try {
      const response = await apiFetch(apiEndpoints.admin.groups, {
        method: "POST",
        body: JSON.stringify({ name: groupForm.name, role: groupForm.role })
      });
      setGroups((prev) => [...prev, response]);
      setGroupError("");
      setGroupForm({ name: "", role: "ACCOUNTANT" });
    } catch (err) {
      setGroupError(err?.payload?.detail || err?.message || "Unable to create group.");
    } finally {
      setGroupSaving(false);
    }
  }

  async function handleGroupPermissionToggle(groupId, code, nextState) {
    setGroupError("");
    setGroupApplyError("");
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              permissions: [
                ...(g.permissions || []).filter((p) => p.code !== code),
                { code, is_allowed: nextState }
              ]
            }
          : g
      )
    );
    setPendingGroupChanges((prev) => {
      const filtered = prev.filter((c) => !(c.type === "group" && c.id === groupId && c.code === code));
      return [...filtered, { type: "group", id: groupId, code, is_allowed: nextState }];
    });
  }

  async function handleApplyGroupPermissions() {
    if (!pendingGroupChanges.length) return;
    setGroupApplySaving(true);
    setGroupApplyError("");
    setGroupError("");
    try {
      const tasks = pendingGroupChanges.map((change) =>
        apiFetch(apiEndpoints.admin.groupPermissions(change.id), {
          method: "PATCH",
          body: JSON.stringify({ code: change.code, is_allowed: change.is_allowed })
        })
      );
      await Promise.all(tasks);
      setPendingGroupChanges([]);
      await loadData(false);
    } catch (err) {
      setGroupApplyError(err?.payload?.detail || err?.message || "Unable to apply group permission changes.");
    } finally {
      setGroupApplySaving(false);
    }
  }

  async function handleApplyUserPermissions() {
    if (!pendingUserChanges.length) return;
    setUserApplySaving(true);
    setUserApplyError("");
    setError("");
    try {
      const tasks = pendingUserChanges.map((change) =>
        apiFetch(apiEndpoints.admin.userPermissions(change.id), {
          method: "PATCH",
          body: JSON.stringify({ code: change.code, is_allowed: change.is_allowed })
        })
      );
      await Promise.all(tasks);
      setPendingUserChanges([]);
      await loadData(false);
    } catch (err) {
      setUserApplyError(err?.payload?.detail || err?.message || "Unable to apply user permission changes.");
    } finally {
      setUserApplySaving(false);
    }
  }

  const allPermissionCodes = permissions.map((p) => p.code);

  const groupColumns = useMemo(() => {
    const base = [
      {
        header: "Group",
        accessorKey: "name",
        cell: ({ row }) => row.original.name
      },
      {
        header: "Role",
        accessorKey: "role",
        cell: ({ row }) => toTitleCase(row.original.role)
      },
      {
        header: "Members",
        accessorKey: "user_count",
        cell: ({ row }) => row.original.user_count || 0
      }
    ];

    const permissionCols = allPermissionCodes.map((code) => ({
      header: () => <div className="whitespace-normal break-words text-center text-[11px]">{code}</div>,
      id: `group-perm-${code}`,
      cell: ({ row }) => {
        const group = row.original;
        const current = (group.permissions || []).find((p) => p.code === code);
        const checked = current ? current.is_allowed : false;
        return (
          <div className="flex justify-center">
            <input
              type="checkbox"
              checked={checked}
              disabled={groupApplySaving}
              onChange={() => handleGroupPermissionToggle(group.id, code, !checked)}
            />
          </div>
        );
      }
    }));

    return [...base, ...permissionCols];
  }, [allPermissionCodes, groupApplySaving, handleGroupPermissionToggle]);

  const columns = useMemo(() => {
    const base = [
      {
        header: "Email",
        accessorKey: "email",
        cell: ({ row }) => row.original.email
      },
      {
        header: "Role",
        accessorKey: "role",
        cell: ({ row }) => (
          <select
            value={row.original.role}
            onChange={(e) => handleRoleChange(row.original.id, e.target.value)}
            disabled={roleUpdatingId === row.original.id}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs"
          >
            {["ADMIN", "ACCOUNTANT", "WAREHOUSE_MANAGER", "SALESMAN", "DRIVER", "BRAND", "RETAILER"].map((role) => (
              <option key={role} value={role}>
                {toTitleCase(role)}
              </option>
            ))}
          </select>
        )
      },
      {
        header: "Group",
        accessorKey: "group_name",
        cell: ({ row }) => {
          const user = row.original;
          return (
            <select
              value={user.group_id || ""}
              onChange={(e) =>
                handleUserGroupChange(user.id, e.target.value ? Number(e.target.value) : null)
              }
              disabled={groupUpdatingId === user.id}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs"
            >
              <option value="">No group</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          );
        }
      },
      {
        header: "Status",
        accessorKey: "is_active",
        cell: ({ row }) => {
          const user = row.original;
          const next = !user.is_active;
          return (
            <label className="flex items-center gap-2 font-medium text-slate-600">
              <span>{user.is_active ? "Enabled" : "Disabled"}</span>
              <input
                type="checkbox"
                checked={user.is_active}
                onChange={() => handleToggleActive(user.id, next)}
                disabled={togglingId === user.id}
                className="peer sr-only"
              />
              <span
                className="relative inline-flex h-5 w-10 items-center rounded-full bg-slate-300 transition peer-checked:bg-emerald-500 peer-disabled:opacity-60"
                aria-hidden="true"
              >
                <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5" />
              </span>
            </label>
          );
        }
      },
      {
        header: "Created",
        accessorKey: "created_at",
        cell: ({ row }) => formatDate(row.original.created_at)
      }
    ];

    const permissionCols = allPermissionCodes.map((code) => ({
      header: () => <div className="whitespace-normal break-words text-center text-[11px]">{code}</div>,
      id: `perm-${code}`,
      cell: ({ row }) => {
        const user = row.original;
        const current = (user.permissions || []).find((p) => p.code === code);
        const checked = current ? current.is_allowed : false;
        const disabled = userApplySaving || !user.is_active;
        return (
          <div className={`flex justify-center ${!user.is_active ? "opacity-40" : ""}`}>
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => handlePermissionToggle(user.id, code, !checked)}
            />
          </div>
        );
      }
    }));

    return [...base, ...permissionCols];
  }, [
    allPermissionCodes,
    groupUpdatingId,
    groups,
    roleUpdatingId,
    togglingId,
    handlePermissionToggle,
    handleRoleChange,
    handleToggleActive,
    handleUserGroupChange,
    userApplySaving
  ]);

  const groupFilters = useMemo(() => {
    const base = groups
      .map((g) => ({ id: g.id, label: g.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return [{ id: "ALL", label: "All groups" }, ...base, { id: null, label: "No group" }];
  }, [groups]);

  const filteredUsers = useMemo(() => {
    if (selectedGroupId === "ALL") return users;
    if (selectedGroupId === null) return users.filter((u) => !u.group_id);
    return users.filter((u) => u.group_id === selectedGroupId);
  }, [selectedGroupId, users]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
        Loading user management…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard title="Groups" subtitle="Shared permissions by role">
        <div className="flex max-h-[70vh] flex-col gap-3">
          <div className="flex-1 overflow-auto">
            <div className="max-w-full overflow-x-auto pb-2">
              <DataTable columns={groupColumns} data={groups} emptyLabel="No groups found." />
            </div>
          </div>
          <div className="sticky bottom-0 flex flex-col gap-3 bg-white/95 pt-3 md:flex-row md:items-center md:justify-end">
            {groupApplyError ? <span className="text-sm text-rose-500">{groupApplyError}</span> : null}
            <button
              type="button"
              onClick={handleApplyGroupPermissions}
              disabled={!pendingGroupChanges.length || groupApplySaving}
              className={primaryButtonClass}
            >
              {groupApplySaving ? "Applying..." : "Apply"}
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Users" subtitle={`${users.length} users`}>
        <div className="flex max-h-[70vh] flex-col gap-3">
          {error ? <p className="text-sm text-rose-500">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
          {groupFilters.map((option) => {
            const isActive = selectedGroupId === option.id;
            return (
              <button
                key={`${option.label}-${option.id === null ? "nogroup" : option.id}`}
                type="button"
                onClick={() => setSelectedGroupId(option.id)}
                className={`${pillButtonClass} transition ${
                  isActive ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {option.label}
              </button>
            );
          })}
          </div>
          <div className="flex-1 overflow-auto">
            <div className="max-w-full overflow-x-auto pb-2">
              <DataTable columns={columns} data={filteredUsers} emptyLabel="No users in this group." />
            </div>
          </div>
          <div className="sticky bottom-0 flex flex-col gap-3 bg-white/95 pt-3 md:flex-row md:items-center md:justify-end">
            {userApplyError ? <span className="text-sm text-rose-500">{userApplyError}</span> : null}
            <button
              type="button"
              onClick={handleApplyUserPermissions}
              disabled={!pendingUserChanges.length || userApplySaving}
              className={primaryButtonClass}
            >
              {userApplySaving ? "Applying..." : "Apply"}
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Create" subtitle="Provision users or groups">
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setCreateMode("user")}
            className={`${pillButtonClass} ${
              createMode === "user" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            New User
          </button>
          <button
            type="button"
            onClick={() => setCreateMode("group")}
            className={`${pillButtonClass} ${
              createMode === "group" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            New Group
          </button>
        </div>

        {createMode === "user" ? (
          <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
            <div className="relative">
              <InputBar
                type="text"
                inputMode="email"
                autoComplete="username"
                value={form.email}
                onChange={(e) => {
                  const rawValue = e.target.value;
                  const localPart = rawValue.split("@")[0].replace(/\s+/g, "");
                  setForm((prev) => ({ ...prev, email: localPart }));
                }}
                placeholder="username"
                className="pr-24"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                @{emailDomain}
              </span>
            </div>
            <InputBar
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={form.phoneNumber}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  phoneNumber: e.target.value.replace(/\D/g, "").slice(0, 10)
                }))
              }
              placeholder="Phone number"
            />
            <InputBar
              type="password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="Password"
            />
            <SelectBar
              value={form.role}
              onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
            >
              {["ADMIN", "ACCOUNTANT", "WAREHOUSE_MANAGER", "SALESMAN", "DRIVER", "BRAND", "RETAILER"].map((role) => (
                <option key={role} value={role}>
                  {toTitleCase(role)}
                </option>
              ))}
            </SelectBar>
            <SelectBar
              value={form.groupId}
              onChange={(e) => {
                const value = e.target.value;
                const selectedGroup = groups.find((g) => g.id === Number(value));
                setForm((prev) => ({
                  ...prev,
                  groupId: value,
                  role: selectedGroup?.role || prev.role
                }));
              }}
            >
              <option value="">No group</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} ({toTitleCase(group.role)})
                </option>
              ))}
            </SelectBar>
            <div className="md:col-span-2 flex items-center justify-between">
              {error ? <p className="text-sm text-rose-500">{error}</p> : <span />}
              <button
                type="submit"
                disabled={saving}
                className={primaryButtonClass}
              >
                {saving ? "Creating..." : "Create User"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleCreateGroup} className="grid gap-4 md:grid-cols-2">
            <InputBar
              type="text"
              value={groupForm.name}
              onChange={(e) => setGroupForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Group name"
            />
            <SelectBar
              value={groupForm.role}
              onChange={(e) => setGroupForm((prev) => ({ ...prev, role: e.target.value }))}
            >
              {["ADMIN", "ACCOUNTANT", "WAREHOUSE_MANAGER", "SALESMAN", "DRIVER", "BRAND", "RETAILER"].map((role) => (
                <option key={role} value={role}>
                  {toTitleCase(role)}
                </option>
              ))}
            </SelectBar>
            <div className="md:col-span-2 flex items-center justify-between">
              {groupError ? <p className="text-sm text-rose-500">{groupError}</p> : <span />}
              <button
                type="submit"
                disabled={groupSaving}
                className={primaryButtonClass}
              >
                {groupSaving ? "Creating..." : "Create Group"}
              </button>
            </div>
          </form>
        )}
      </SectionCard>
    </div>
  );
}
