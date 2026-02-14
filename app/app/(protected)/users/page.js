"use client";

import { useEffect, useMemo, useState } from "react";
import { apiEndpoints, apiFetch, invalidateApiCache } from "@/lib/api";
import { toTitleCase } from "@/lib/format";
import SectionCard from "@/components/layout/SectionCard";
import DataTable from "@/components/tables/DataTable";
import { InputBar, SelectBar } from "@/components/ui/InputBars";
import { useToast } from "@/components/ui/ToastProvider";
import { getAccessToken, getUserFromToken } from "@/lib/auth";

export default function AdminUsers() {
  const emailDomain = "ascendfoods.in";
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [form, setForm] = useState({ email: "", phoneNumber: "", password: "", role: "ACCOUNTANT", groupId: "" });
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roleUpdatingId, setRoleUpdatingId] = useState(null);
  const [groupUpdatingId, setGroupUpdatingId] = useState(null);
  const [groupForm, setGroupForm] = useState({ name: "", role: "ACCOUNTANT" });
  const [groupSaving, setGroupSaving] = useState(false);
  const [pendingGroupChanges, setPendingGroupChanges] = useState([]);
  const [pendingUserChanges, setPendingUserChanges] = useState([]);
  const [groupApplySaving, setGroupApplySaving] = useState(false);
  const [userApplySaving, setUserApplySaving] = useState(false);
  const [accessRules, setAccessRules] = useState([]);
  const [accessRulesError, setAccessRulesError] = useState("");
  const [accessRuleSavingId, setAccessRuleSavingId] = useState(null);
  const [accessRuleDeletingId, setAccessRuleDeletingId] = useState(null);
  const [accessRuleForm, setAccessRuleForm] = useState({ path: "", roles: [], permissions: [] });
  const [accessRuleFormSaving, setAccessRuleFormSaving] = useState(false);
  const [dirtyAccessRuleIds, setDirtyAccessRuleIds] = useState([]);
  const [groupApplyError, setGroupApplyError] = useState("");
  const [userApplyError, setUserApplyError] = useState("");
  const [error, setError] = useState("");
  const [groupError, setGroupError] = useState("");
  const [createMode, setCreateMode] = useState("user");
  const [selectedGroupId, setSelectedGroupId] = useState("ALL");
  const [passwordValue, setPasswordValue] = useState("");
  const [passwordSavingId, setPasswordSavingId] = useState(null);
  const [deleteSavingId, setDeleteSavingId] = useState(null);
  const [modalUser, setModalUser] = useState(null);
  const [modalMode, setModalMode] = useState(null);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(false);
  const { notify } = useToast();
  const currentUser = getUserFromToken(getAccessToken());
  const currentUserId = currentUser?.id ? Number(currentUser.id) : null;
  const roleOptions = ["ADMIN", "ACCOUNTANT", "WAREHOUSE_MANAGER", "SALESMAN", "DRIVER", "BRAND", "RETAILER"];

  const normalizeRoleValue = (value) => {
    if (!value) return "";
    const raw = typeof value === "string" ? value : String(value);
    const cleaned = raw.includes(".") ? raw.split(".").pop() : raw;
    const upper = cleaned.toUpperCase();
    return roleOptions.includes(upper) ? upper : cleaned;
  };

  const mergePermissions = (current, updates) => {
    const existing = current || [];
    const filtered = existing.filter((perm) => !updates.some((update) => update.code === perm.code));
    return [...filtered, ...updates];
  };

  const mergePendingChanges = (current, type, id, updates) => {
    const filtered = current.filter(
      (change) => !(change.type === type && change.id === id && updates.some((update) => update.code === change.code))
    );
    return [
      ...filtered,
      ...updates.map((update) => ({
        type,
        id,
        code: update.code,
        is_allowed: update.is_allowed
      }))
    ];
  };

  const getPermissionState = (permissionsList, code) => {
    return (permissionsList || []).find((perm) => perm.code === code)?.is_allowed || false;
  };

  const getPermissionUpdates = (permissionsList, code, nextState) => {
    const updates = [{ code, is_allowed: nextState }];
    if (code === "inventory.manage" && nextState) {
      if (!getPermissionState(permissionsList, "inventory.view")) {
        updates.push({ code: "inventory.view", is_allowed: true });
      }
    }
    if (code === "inventory.view" && !nextState) {
      if (getPermissionState(permissionsList, "inventory.manage")) {
        updates.push({ code: "inventory.manage", is_allowed: false });
      }
    }
    return updates;
  };

  const primaryButtonClass = "h-11 rounded-full bg-slate-900 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50";
  const pillButtonClass = "h-11 rounded-full px-4 text-sm font-semibold";
  const sortAccessRules = (rules) => [...rules].sort((a, b) => a.path.localeCompare(b.path));
  const markAccessRuleDirty = (ruleId) => {
    setDirtyAccessRuleIds((prev) => (prev.includes(ruleId) ? prev : [...prev, ruleId]));
  };
  const clearAccessRuleDirty = (ruleId) => {
    setDirtyAccessRuleIds((prev) => prev.filter((id) => id !== ruleId));
  };

  async function loadData(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const [usersResponse, permsResponse, groupsResponse, accessRulesResponse] = await Promise.all([
        apiFetch(apiEndpoints.admin.users),
        apiFetch(apiEndpoints.admin.permissions),
        apiFetch(apiEndpoints.admin.groups),
        apiFetch(apiEndpoints.admin.accessRules)
      ]);
      setUsers(usersResponse || []);
      setPermissions(permsResponse || []);
      setGroups(groupsResponse || []);
      setAccessRules(sortAccessRules(accessRulesResponse || []));
      setDirtyAccessRuleIds([]);
      setError("");
      setGroupError("");
      setAccessRulesError("");
      setGroupApplyError("");
      setUserApplyError("");
    } catch (err) {
      setError(err?.message || "Unable to load users.");
      setGroupError(err?.message || "Unable to load groups.");
      setAccessRulesError(err?.message || "Unable to load access rules.");
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
      notify("User created.");
      await loadData(false);
    } catch (err) {
      setError(err?.payload?.detail || err?.message || "Unable to create user.");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword(userId) {
    if (!passwordValue) {
      setError("Enter a new password.");
      return;
    }
    setError("");
    setPasswordSavingId(userId);
    try {
      await apiFetch(apiEndpoints.admin.userPassword(userId), {
        method: "PATCH",
        body: JSON.stringify({ password: passwordValue })
      });
      setPasswordValue("");
      notify("Password updated.");
    } catch (err) {
      setError(err?.payload?.detail || err?.message || "Unable to update password.");
    } finally {
      setPasswordSavingId(null);
    }
  }

  async function handleDeleteUser(userId) {
    setDeleteSavingId(userId);
    setError("");
    try {
      await apiFetch(apiEndpoints.admin.userDelete(userId), { method: "DELETE" });
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      closeModal();
      notify("User deleted.");
    } catch (err) {
      setError(err?.payload?.detail || err?.message || "Unable to delete user.");
    } finally {
      setDeleteSavingId(null);
    }
  }

  function openPasswordModal(user) {
    setModalUser(user);
    setModalMode("password");
    setPasswordValue("");
    setError("");
  }

  function openDeleteModal(user) {
    setModalUser(user);
    setModalMode("delete");
    setDeleteConfirmStep(false);
    setError("");
  }

  function closeModal() {
    setModalUser(null);
    setModalMode(null);
    setPasswordValue("");
    setDeleteConfirmStep(false);
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
    const user = users.find((entry) => entry.id === userId);
    const updates = getPermissionUpdates(user?.permissions || [], code, nextState);
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              permissions: mergePermissions(u.permissions || [], updates)
            }
          : u
      )
    );
    setPendingUserChanges((prev) => mergePendingChanges(prev, "user", userId, updates));
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
      notify("Group created.");
    } catch (err) {
      setGroupError(err?.payload?.detail || err?.message || "Unable to create group.");
    } finally {
      setGroupSaving(false);
    }
  }

  async function handleGroupPermissionToggle(groupId, code, nextState) {
    setGroupError("");
    setGroupApplyError("");
    const group = groups.find((entry) => entry.id === groupId);
    const updates = getPermissionUpdates(group?.permissions || [], code, nextState);
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              permissions: mergePermissions(g.permissions || [], updates)
            }
          : g
      )
    );
    setPendingGroupChanges((prev) => mergePendingChanges(prev, "group", groupId, updates));
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
  const roleLabels = roleOptions.map((role) => ({ role, label: toTitleCase(role) }));

  function toggleAccessRuleRole(ruleId, role) {
    setAccessRules((prev) =>
      prev.map((rule) => {
        if (rule.id !== ruleId) return rule;
        const roles = new Set(rule.roles || []);
        if (roles.has(role)) {
          roles.delete(role);
        } else {
          roles.add(role);
        }
        return { ...rule, roles: Array.from(roles) };
      })
    );
    markAccessRuleDirty(ruleId);
  }

  function toggleAccessRulePermission(ruleId, code) {
    setAccessRules((prev) =>
      prev.map((rule) => {
        if (rule.id !== ruleId) return rule;
        const permissionsList = new Set(rule.permissions || []);
        if (permissionsList.has(code)) {
          permissionsList.delete(code);
        } else {
          permissionsList.add(code);
        }
        return { ...rule, permissions: Array.from(permissionsList) };
      })
    );
    markAccessRuleDirty(ruleId);
  }

  async function handleSaveAccessRule(rule) {
    setAccessRulesError("");
    setAccessRuleSavingId(rule.id);
    try {
      const response = await apiFetch(apiEndpoints.admin.accessRules, {
        method: "PATCH",
        body: JSON.stringify({
          path: rule.path,
          roles: rule.roles || [],
          permissions: rule.permissions || []
        })
      });
      setAccessRules((prev) => sortAccessRules(prev.map((entry) => (entry.id === rule.id ? response : entry))));
      clearAccessRuleDirty(rule.id);
      invalidateApiCache(apiEndpoints.auth.accessRules);
    } catch (err) {
      setAccessRulesError(err?.payload?.detail || err?.message || "Unable to save access rule.");
    } finally {
      setAccessRuleSavingId(null);
    }
  }

  async function handleDeleteAccessRule(ruleId) {
    setAccessRulesError("");
    setAccessRuleDeletingId(ruleId);
    try {
      await apiFetch(`${apiEndpoints.admin.accessRules}/${ruleId}`, { method: "DELETE" });
      setAccessRules((prev) => prev.filter((entry) => entry.id !== ruleId));
      clearAccessRuleDirty(ruleId);
      invalidateApiCache(apiEndpoints.auth.accessRules);
    } catch (err) {
      setAccessRulesError(err?.payload?.detail || err?.message || "Unable to delete access rule.");
    } finally {
      setAccessRuleDeletingId(null);
    }
  }

  async function handleCreateAccessRule(event) {
    event.preventDefault();
    setAccessRulesError("");
    if (!accessRuleForm.path.trim()) {
      setAccessRulesError("Access rule path is required.");
      return;
    }
    setAccessRuleFormSaving(true);
    try {
      const response = await apiFetch(apiEndpoints.admin.accessRules, {
        method: "PATCH",
        body: JSON.stringify({
          path: accessRuleForm.path.trim(),
          roles: accessRuleForm.roles,
          permissions: accessRuleForm.permissions
        })
      });
      setAccessRules((prev) => {
        const next = prev.filter((entry) => entry.id !== response.id);
        return sortAccessRules([...next, response]);
      });
      setAccessRuleForm({ path: "", roles: [], permissions: [] });
      invalidateApiCache(apiEndpoints.auth.accessRules);
    } catch (err) {
      setAccessRulesError(err?.payload?.detail || err?.message || "Unable to create access rule.");
    } finally {
      setAccessRuleFormSaving(false);
    }
  }

  function toggleAccessRuleFormRole(role) {
    setAccessRuleForm((prev) => {
      const roles = new Set(prev.roles || []);
      if (roles.has(role)) {
        roles.delete(role);
      } else {
        roles.add(role);
      }
      return { ...prev, roles: Array.from(roles) };
    });
  }

  function toggleAccessRuleFormPermission(code) {
    setAccessRuleForm((prev) => {
      const permissionsList = new Set(prev.permissions || []);
      if (permissionsList.has(code)) {
        permissionsList.delete(code);
      } else {
        permissionsList.add(code);
      }
      return { ...prev, permissions: Array.from(permissionsList) };
    });
  }

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
        header: () => <div className="min-w-[240px]">Email</div>,
        accessorKey: "email",
        meta: { align: "center" },
        cell: ({ row }) => <div className="min-w-[240px]">{row.original.email}</div>
      },
      {
        header: () => <div className="min-w-[160px]">Phone</div>,
        accessorKey: "phone_number",
        meta: { align: "left" },
        cell: ({ row }) => (
          <div className="min-w-[160px] text-slate-600">
            {row.original.phone_number || "—"}
          </div>
        )
      },
      {
        header: () => <div className="min-w-[180px]">Role</div>,
        accessorKey: "role",
        meta: { align: "left" },
        cell: ({ row }) => (
          <div className="min-w-[180px] flex items-center justify-start">
            <SelectBar
              value={normalizeRoleValue(row.original.role)}
              onChange={(e) => handleRoleChange(row.original.id, e.target.value)}
              disabled={roleUpdatingId === row.original.id}
              size="sm"
              className="w-full pr-8 text-left"
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {toTitleCase(role)}
                </option>
              ))}
            </SelectBar>
          </div>
        )
      },
      {
        header: () => <div className="min-w-[220px]">Group</div>,
        accessorKey: "group_name",
        meta: { align: "left" },
        cell: ({ row }) => {
          const user = row.original;
          return (
            <div className="min-w-[220px] flex items-center justify-start">
              <SelectBar
                value={user.group_id ? String(user.group_id) : ""}
                onChange={(e) =>
                  handleUserGroupChange(user.id, e.target.value ? Number(e.target.value) : null)
                }
                disabled={groupUpdatingId === user.id}
                size="sm"
                className="w-full pr-8 text-left"
              >
                <option value="">No group</option>
                {groups.map((group) => (
                  <option key={group.id} value={String(group.id)}>
                    {group.name}
                  </option>
                ))}
              </SelectBar>
            </div>
          );
        }
      },
      {
        header: () => <div className="min-w-[120px]">Actions</div>,
        id: "actions",
        meta: { align: "center" },
        cell: ({ row }) => {
          const user = row.original;
          const isCurrentUser = currentUserId === user.id;
          return (
            <div className="flex min-w-[120px] items-center gap-2 whitespace-nowrap">
              <button
                type="button"
                onClick={() => openPasswordModal(user)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
                title="Reset password"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                  <path
                    fill="currentColor"
                    d="M7 14a4 4 0 1 1 3.46-6H21v4h-2v2h-2v-2h-2v2h-2.46A4 4 0 0 1 7 14Zm0-2a2 2 0 1 0-1.41-.59A2 2 0 0 0 7 12Z"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => openDeleteModal(user)}
                disabled={isCurrentUser}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 text-rose-500 transition hover:border-rose-300 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                title={isCurrentUser ? "You cannot delete yourself" : "Delete user"}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                  <path
                    fill="currentColor"
                    d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9ZM7 9h2v9H7V9Z"
                  />
                </svg>
              </button>
            </div>
          );
        }
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
    currentUser,
    groupUpdatingId,
    groups,
    handlePermissionToggle,
    handleRoleChange,
    handleUserGroupChange,
    roleUpdatingId,
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
              <div className="min-w-[1450px]">
                <DataTable columns={columns} data={filteredUsers} emptyLabel="No users in this group." />
              </div>
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

      <SectionCard title="Access Rules" subtitle="Route-level access control">
        <div className="space-y-4">
          {accessRulesError ? <p className="text-sm text-rose-500">{accessRulesError}</p> : null}
          <form
            onSubmit={handleCreateAccessRule}
            className="rounded-2xl border border-slate-200 bg-white/70 p-4"
          >
            <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
              <div>
                <label className="text-xs uppercase tracking-widest text-slate-400">Path</label>
                <InputBar
                  type="text"
                  value={accessRuleForm.path}
                  onChange={(event) => setAccessRuleForm((prev) => ({ ...prev, path: event.target.value }))}
                  placeholder="/app/some-route"
                  className="mt-2"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-400">Roles</p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {roleLabels.map(({ role, label }) => (
                      <label key={`new-role-${role}`} className="flex items-center gap-2 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          checked={(accessRuleForm.roles || []).includes(role)}
                          onChange={() => toggleAccessRuleFormRole(role)}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-400">Permissions required</p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {allPermissionCodes.length ? (
                      allPermissionCodes.map((code) => (
                        <label key={`new-perm-${code}`} className="flex items-center gap-2 text-sm text-slate-600">
                          <input
                            type="checkbox"
                            checked={(accessRuleForm.permissions || []).includes(code)}
                            onChange={() => toggleAccessRuleFormPermission(code)}
                          />
                          <span>{code}</span>
                        </label>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400">No permissions configured.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={accessRuleFormSaving}
                className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white disabled:opacity-60"
              >
                {accessRuleFormSaving ? "Saving..." : "Add Rule"}
              </button>
            </div>
          </form>

          {accessRules.length ? (
            <div className="space-y-4">
              {accessRules.map((rule) => {
                const isDirty = dirtyAccessRuleIds.includes(rule.id);
                const isSaving = accessRuleSavingId === rule.id;
                const isDeleting = accessRuleDeletingId === rule.id;
                return (
                  <div key={rule.id} className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-widest text-slate-400">Path</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{rule.path}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveAccessRule(rule)}
                          disabled={!isDirty || isSaving || isDeleting}
                          className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-widest disabled:opacity-50 ${
                            isDirty
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 text-slate-600"
                          }`}
                        >
                          {isSaving ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAccessRule(rule.id)}
                          disabled={isDeleting || isSaving}
                          className="rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-rose-600 disabled:opacity-50"
                        >
                          {isDeleting ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-widest text-slate-400">Roles</p>
                        <div className="mt-2 flex flex-wrap gap-3">
                          {roleLabels.map(({ role, label }) => (
                            <label key={`${rule.id}-role-${role}`} className="flex items-center gap-2 text-sm text-slate-600">
                              <input
                                type="checkbox"
                                checked={(rule.roles || []).includes(role)}
                                onChange={() => toggleAccessRuleRole(rule.id, role)}
                                disabled={isSaving || isDeleting}
                              />
                              <span>{label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-widest text-slate-400">Permissions required</p>
                        <div className="mt-2 flex flex-wrap gap-3">
                          {allPermissionCodes.length ? (
                            allPermissionCodes.map((code) => (
                              <label key={`${rule.id}-perm-${code}`} className="flex items-center gap-2 text-sm text-slate-600">
                                <input
                                  type="checkbox"
                                  checked={(rule.permissions || []).includes(code)}
                                  onChange={() => toggleAccessRulePermission(rule.id, code)}
                                  disabled={isSaving || isDeleting}
                                />
                                <span>{code}</span>
                              </label>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">No permissions configured.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-400">
              No access rules configured.
            </div>
          )}
        </div>
      </SectionCard>

      {modalMode && modalUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">User action</p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">
                  {modalMode === "password" ? "Reset password" : "Delete user"}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-sm text-slate-400 hover:text-slate-600"
                aria-label="Close dialog"
              >
                x
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <p className="text-xs uppercase tracking-widest text-slate-400">Selected user</p>
              <p className="mt-1 font-semibold text-slate-900">{modalUser.email}</p>
            </div>

            {modalMode === "password" ? (
              <div className="mt-4 space-y-3">
                <InputBar
                  type="password"
                  value={passwordValue}
                  onChange={(event) => setPasswordValue(event.target.value)}
                  placeholder="New password"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResetPassword(modalUser.id)}
                    disabled={passwordSavingId === modalUser.id}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700"
                  >
                    {passwordSavingId === modalUser.id ? "Saving..." : "Update password"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p>This is a soft delete and will immediately revoke access.</p>
                {deleteConfirmStep ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
                    <p className="font-semibold">Are you absolutely sure?</p>
                    <p className="mt-1 text-xs text-rose-600">This action cannot be undone.</p>
                  </div>
                ) : null}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
                  >
                    Cancel
                  </button>
                  {!deleteConfirmStep ? (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmStep(true)}
                      className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700"
                    >
                      Continue
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(modalUser.id)}
                      disabled={deleteSavingId === modalUser.id}
                      className="rounded-full border border-rose-200 bg-rose-600 px-4 py-2 text-xs font-semibold text-white"
                    >
                      {deleteSavingId === modalUser.id ? "Deleting..." : "Confirm delete"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

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
