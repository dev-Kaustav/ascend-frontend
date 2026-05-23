"use client";

import { useEffect, useMemo, useState } from "react";
import { apiEndpoints, apiFetch, invalidateApiCache } from "@/lib/api";
import { toTitleCase } from "@/lib/format";
import { InputBar, SelectBar } from "@/components/ui/InputBars";
import HoverScrollbar from "@/components/ui/HoverScrollbar";
import { useToast } from "@/components/ui/ToastProvider";
import { getAccessToken, getUserFromToken } from "@/lib/auth";
import { DEFAULT_WORKSPACE_ACCESS_RULES, filterManagedAccessRules } from "@/lib/workspaceRoutes";

export default function AdminUsers({
  showHeader = true,
  showGroupsSection = true,
  showUsersSection = true,
  showAccessRulesSection = true
} = {}) {
  const emailDomain = "ascendfoods.in";
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [form, setForm] = useState({ email: "", phoneNumber: "", password: "", role: "ACCOUNTANT", groupId: "" });
  const [passwordEdited, setPasswordEdited] = useState(false);
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
  const [selectedGroupId, setSelectedGroupId] = useState("ALL");
  const [passwordValue, setPasswordValue] = useState("");
  const [passwordSavingId, setPasswordSavingId] = useState(null);
  const [deleteSavingId, setDeleteSavingId] = useState(null);
  const [modalUser, setModalUser] = useState(null);
  const [modalMode, setModalMode] = useState(null);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(false);
  const [userPermissionModalId, setUserPermissionModalId] = useState(null);
  const [groupPermissionModalId, setGroupPermissionModalId] = useState(null);
  const [expandedPermissionCategory, setExpandedPermissionCategory] = useState(null);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [editingAccessRule, setEditingAccessRule] = useState(null);
  const [showCreateAccessRuleModal, setShowCreateAccessRuleModal] = useState(false);
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

  const getInitials = (email) =>
    (email || "U")
      .split("@")[0]
      .split(/[._-]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "U";

  const countEnabledPermissions = (entries) => (entries || []).filter((entry) => entry.is_allowed).length;

  const getRoleBadgeClass = (role) => {
    switch (normalizeRoleValue(role)) {
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
  };

  const primaryButtonClass =
    "inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#a855f7] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#7c3aed]/20 transition hover:from-[#6d28d9] hover:to-[#9333ea] disabled:cursor-not-allowed disabled:opacity-50";
  const secondaryButtonClass =
    "inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
  const dangerButtonClass =
    "inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50";
  const pillButtonClass = "rounded-full px-4 py-2.5 text-sm font-semibold transition";
  const modalCardClass = "w-full max-w-2xl overflow-hidden rounded-[1.75rem] bg-white shadow-2xl";
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
      setAccessRules(sortAccessRules(filterManagedAccessRules(accessRulesResponse || [])));
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
      setShowCreateGroupModal(false);
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
      setShowCreateAccessRuleModal(false);
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
    return [{ id: "ALL", label: "All groups" }, ...base];
  }, [groups]);

  const availableAccessRulePaths = useMemo(() => {
    const configured = new Set(accessRules.map((rule) => rule.path));
    return DEFAULT_WORKSPACE_ACCESS_RULES
      .map((rule) => rule.path)
      .filter((path) => !configured.has(path));
  }, [accessRules]);

  useEffect(() => {
    if (!availableAccessRulePaths.length) {
      setAccessRuleForm((prev) => (prev.path ? { ...prev, path: "" } : prev));
      return;
    }
    setAccessRuleForm((prev) => {
      if (prev.path && availableAccessRulePaths.includes(prev.path)) return prev;
      return { ...prev, path: availableAccessRulePaths[0] };
    });
  }, [availableAccessRulePaths]);

  const filteredUsers = useMemo(() => {
    if (selectedGroupId === "ALL") return users;
    if (selectedGroupId === null) return users.filter((u) => !u.group_id);
    return users.filter((u) => u.group_id === selectedGroupId);
  }, [selectedGroupId, users]);

  const permissionCategories = useMemo(() => {
    const labels = {
      accounting: "Accounting",
      inventory: "Inventory",
      orders: "Orders",
      users: "Users"
    };
    return permissions.reduce((acc, permission) => {
      const prefix = permission.code.split(".")[0];
      const label = labels[prefix] || toTitleCase(prefix);
      if (!acc[label]) acc[label] = [];
      acc[label].push(permission.code);
      return acc;
    }, {});
  }, [permissions]);

  const firstPermissionCategory = Object.keys(permissionCategories)[0] || null;
  const activeUserPermissionTarget = users.find((user) => user.id === userPermissionModalId) || null;
  const activeGroupPermissionTarget = groups.find((group) => group.id === groupPermissionModalId) || null;

  const openUserPermissionModal = (userId) => {
    setUserPermissionModalId(userId);
    setExpandedPermissionCategory(firstPermissionCategory);
  };

  const openGroupPermissionModal = (groupId) => {
    setGroupPermissionModalId(groupId);
    setExpandedPermissionCategory(firstPermissionCategory);
  };

  const closePermissionModal = () => {
    setUserPermissionModalId(null);
    setGroupPermissionModalId(null);
    setExpandedPermissionCategory(null);
  };

  const getCategoryEnabledCount = (permissionEntries, codes) =>
    (codes || []).filter((code) => getPermissionState(permissionEntries, code)).length;

  const openEditAccessRuleModal = (rule) => {
    setEditingAccessRule({
      ...rule,
      roles: [...(rule.roles || [])],
      permissions: [...(rule.permissions || [])]
    });
  };

  const toggleEditingAccessRuleRole = (role) => {
    setEditingAccessRule((prev) => {
      const roles = new Set(prev?.roles || []);
      if (roles.has(role)) roles.delete(role);
      else roles.add(role);
      return { ...prev, roles: Array.from(roles) };
    });
  };

  const toggleEditingAccessRulePermission = (code) => {
    setEditingAccessRule((prev) => {
      const permissionsList = new Set(prev?.permissions || []);
      if (permissionsList.has(code)) permissionsList.delete(code);
      else permissionsList.add(code);
      return { ...prev, permissions: Array.from(permissionsList) };
    });
  };

  if (loading) {
    return (
      <div className="rounded-[1.5rem] border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.35)]">
        Loading user management…
      </div>
    );
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
            <p className="mt-1 text-sm text-slate-600">Manage group permissions</p>
          </div>
          <button type="button" onClick={() => setShowCreateGroupModal(true)} className={primaryButtonClass}>
            + Add Group
          </button>
        </div>
        {groupApplyError ? <p className="mb-3 text-sm text-rose-500">{groupApplyError}</p> : null}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => {
            const enabledCount = countEnabledPermissions(group.permissions);
            const coverage = allPermissionCodes.length ? (enabledCount / allPermissionCodes.length) * 100 : 0;
            return (
              <article
                key={group.id}
                className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{group.name}</h3>
                    <p className="mt-0.5 text-xs text-slate-600">{toTitleCase(group.role)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openGroupPermissionModal(group.id)}
                    className="rounded-lg p-2 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100"
                    aria-label={`Edit ${group.name}`}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                      <path d="M4 20h4l10-10-4-4L4 16v4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                      <path d="m12 6 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>

                <div className="mb-4 mt-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 text-purple-600">
                      <path d="M12 3 6 5v5c0 4 2.6 7.5 6 9 3.4-1.5 6-5 6-9V5l-6-2Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Members</p>
                    <p className="text-lg font-bold text-slate-900">{group.user_count || 0}</p>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Permissions</span>
                    <span className="font-semibold text-purple-600">
                      {enabledCount} / {allPermissionCodes.length || 0}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-600" style={{ width: `${coverage}%` }} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        </section>
      ) : null}

      {showUsersSection ? (
        <section>
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-[1.55rem] font-bold tracking-[-0.03em] text-slate-900">Users</h2>
            <p className="mt-1 text-sm text-slate-600">{filteredUsers.length} active users</p>
          </div>
          <button type="button" onClick={() => { setPasswordEdited(false); setShowCreateUserModal(true); }} className={primaryButtonClass}>
            + Add User
          </button>
        </div>
        {error ? <p className="mb-3 text-sm text-rose-500">{error}</p> : null}
        <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
          <div className="border-b border-slate-200/60 bg-white px-8 py-6">
            <div className="flex flex-wrap gap-2.5">
              {groupFilters.map((option) => {
                const isActive = selectedGroupId === option.id;
                return (
                  <button
                    key={`${option.label}-${option.id === null ? "nogroup" : option.id}`}
                    type="button"
                    onClick={() => setSelectedGroupId(option.id)}
                    className={`cursor-pointer rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                      isActive
                        ? "bg-[#1a1b2e] text-white shadow-lg shadow-[#1a1b2e]/20"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="divide-y divide-slate-200/60">
            {filteredUsers.length ? (
              filteredUsers.map((user) => {
                const enabledCount = countEnabledPermissions(user.permissions);
                return (
                  <div key={user.id} className="group/user px-8 py-6 transition-colors hover:bg-slate-50/50">
                    <div className="flex items-center justify-between gap-6">
                      <div className="flex flex-1 items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 text-sm font-bold text-white shadow-lg shadow-purple-500/20">
                          {getInitials(user.email)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="text-sm font-bold text-slate-900">{user.email}</h3>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getRoleBadgeClass(user.role)}`}>
                              {toTitleCase(user.role)}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-4 text-xs text-slate-600">
                            <p>{user.phone_number || "—"}</p>
                            <span className="text-slate-400">•</span>
                            <p>{user.group_name || "No group"}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="mr-4 text-right">
                          <p className="text-xs text-slate-500">Permissions</p>
                          <p className="text-sm font-bold text-purple-600">
                            {enabledCount} / {allPermissionCodes.length || 0}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openUserPermissionModal(user.id)}
                          className="cursor-pointer rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm font-medium text-purple-700 transition-colors duration-200 hover:border-purple-300 hover:bg-purple-50"
                        >
                          Edit Permissions
                        </button>
                        {currentUserId !== user.id ? (
                          <button
                            type="button"
                            onClick={() => openDeleteModal(user)}
                            className="cursor-pointer rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-600 transition-colors duration-200 hover:border-rose-300 hover:bg-rose-50"
                          >
                            Delete User
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-8 py-10 text-sm text-slate-400">No users in this group.</div>
            )}
          </div>
        </div>
        {userApplyError ? <p className="mt-3 text-sm text-rose-500">{userApplyError}</p> : null}
        </section>
      ) : null}

      {showAccessRulesSection ? (
        <section>
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-[1.55rem] font-bold tracking-[-0.03em] text-slate-900">Access Rules</h2>
            <p className="mt-1 text-sm text-slate-600">Route-level access control • {accessRules.length} rules configured</p>
          </div>
          {availableAccessRulePaths.length ? (
            <button type="button" onClick={() => setShowCreateAccessRuleModal(true)} className={primaryButtonClass}>
              + Add Rule
            </button>
          ) : null}
        </div>
        {accessRulesError ? <p className="mb-3 text-sm text-rose-500">{accessRulesError}</p> : null}
        <div className="grid gap-4 md:grid-cols-2">
          {accessRules.map((rule) => (
            <article
              key={rule.id}
              className="group rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 text-slate-600">
                      <path d="M5 7h6v4H5zM13 5h6v6h-6zM5 13h6v6H5zM13 15h6v4h-6z" fill="none" stroke="currentColor" strokeWidth="1.8" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{rule.path}</h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {(rule.roles || []).length} roles • {(rule.permissions || []).length} permissions
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => openEditAccessRuleModal(rule)}
                    className="cursor-pointer rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    aria-label={`Edit ${rule.path}`}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                      <path d="M4 20h4l10-10-4-4L4 16v4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                      <path d="m12 6 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteAccessRule(rule.id)}
                    disabled={accessRuleDeletingId === rule.id}
                    className="cursor-pointer rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    aria-label={`Delete ${rule.path}`}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                      <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9ZM7 9h2v9H7V9Z" fill="currentColor" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5 text-slate-500">
                      <path d="M8 10V7a4 4 0 1 1 8 0v3M6 10h12v9H6z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    Allowed Roles
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(rule.roles || []).length ? (
                      rule.roles.map((role) => (
                        <span key={`${rule.id}-${role}`} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {toTitleCase(role)}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">No roles selected</span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5 text-purple-500">
                      <path d="M12 3 6 5v5c0 4 2.6 7.5 6 9 3.4-1.5 6-5 6-9V5l-6-2Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
                    </svg>
                    Required Permissions
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(rule.permissions || []).length ? (
                      rule.permissions.map((code) => (
                        <span key={`${rule.id}-${code}`} className="rounded-md bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-700">
                          {code}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400">No additional permissions required</span>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
        </section>
      ) : null}

      {(activeGroupPermissionTarget || activeUserPermissionTarget) ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <div className={modalCardClass}>
            <div className="border-b border-slate-200 bg-gradient-to-r from-purple-50 to-white px-8 py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    {activeGroupPermissionTarget ? activeGroupPermissionTarget.name : "Edit Permissions"}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {activeGroupPermissionTarget
                      ? `Group Permissions • ${toTitleCase(activeGroupPermissionTarget.role)}`
                      : activeUserPermissionTarget?.email}
                  </p>
                </div>
                <button type="button" onClick={closePermissionModal} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Close">
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 text-slate-600">
                    <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>

            <HoverScrollbar className="max-h-[65vh] px-8 py-6">
              <div className="space-y-6">
                {Object.entries(permissionCategories).map(([category, codes]) => {
                  const targetPermissions = activeGroupPermissionTarget?.permissions || activeUserPermissionTarget?.permissions || [];
                  const enabledCount = getCategoryEnabledCount(targetPermissions, codes);
                  const isExpanded = expandedPermissionCategory === category;
                  return (
                    <div key={category} className="overflow-hidden rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setExpandedPermissionCategory(isExpanded ? null : category)}
                        className="flex w-full items-center justify-between bg-slate-50 px-6 py-4 transition-colors hover:bg-slate-100"
                      >
                        <div className="flex items-center gap-3">
                          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 text-purple-600">
                            <path d="M12 3 6 5v5c0 4 2.6 7.5 6 9 3.4-1.5 6-5 6-9V5l-6-2Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
                          </svg>
                          <span className="font-bold text-slate-900">{category}</span>
                          <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-700">
                            {enabledCount} / {codes.length}
                          </span>
                        </div>
                        <svg viewBox="0 0 24 24" aria-hidden="true" className={`h-5 w-5 text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}>
                          <path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>

                      {isExpanded ? (
                        <div className="space-y-4 bg-white p-6">
                          {codes.map((code) => {
                            const checked = getPermissionState(targetPermissions, code);
                            const toggleFn = activeGroupPermissionTarget
                              ? () => handleGroupPermissionToggle(activeGroupPermissionTarget.id, code, !checked)
                              : () => handlePermissionToggle(activeUserPermissionTarget.id, code, !checked);
                            return (
                              <label key={code} className="flex cursor-pointer items-center gap-4 rounded-lg px-4 py-3 transition-colors hover:bg-slate-50">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={toggleFn}
                                  className="h-5 w-5 rounded border-slate-300 accent-accent"
                                />
                                <span className="text-sm font-medium text-slate-700">{code}</span>
                              </label>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </HoverScrollbar>

            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/60 px-8 py-5">
              <div className="text-sm text-rose-500">{activeGroupPermissionTarget ? groupApplyError : userApplyError}</div>
              <div className="flex gap-3">
                {activeUserPermissionTarget ? (
                  <button
                    type="button"
                    onClick={() => {
                      closePermissionModal();
                      openPasswordModal(activeUserPermissionTarget);
                    }}
                    className={secondaryButtonClass}
                  >
                    Reset Password
                  </button>
                ) : null}
                <button type="button" onClick={closePermissionModal} className={secondaryButtonClass}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (activeGroupPermissionTarget) {
                      await handleApplyGroupPermissions();
                    } else {
                      await handleApplyUserPermissions();
                    }
                    closePermissionModal();
                  }}
                  disabled={activeGroupPermissionTarget ? groupApplySaving : userApplySaving}
                  className={primaryButtonClass}
                >
                  {activeGroupPermissionTarget
                    ? groupApplySaving
                      ? "Saving..."
                      : "Save Changes"
                    : userApplySaving
                      ? "Saving..."
                      : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editingAccessRule ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <div className={modalCardClass}>
            <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-8 py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Edit Access Rule</h3>
                  <p className="mt-1 text-sm text-slate-600">{editingAccessRule.path}</p>
                </div>
                <button type="button" onClick={() => setEditingAccessRule(null)} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Close">
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 text-slate-600">
                    <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>

            <HoverScrollbar className="max-h-[70vh] px-8 py-6">
              <div className="space-y-8">
                <div>
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-slate-900">
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 text-slate-600">
                      <path d="M8 10V7a4 4 0 1 1 8 0v3M6 10h12v9H6z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    Allowed Roles
                  </div>
                  <p className="mb-4 text-sm text-slate-600">Which user roles can access this route?</p>
                  <div className="grid grid-cols-2 gap-3">
                    {roleLabels.map(({ role, label }) => (
                      <label key={role} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-4 py-4">
                        <input
                          type="checkbox"
                          checked={(editingAccessRule.roles || []).includes(role)}
                          onChange={() => toggleEditingAccessRuleRole(role)}
                          className="h-5 w-5 rounded border-slate-300 accent-slate-900"
                        />
                        <span className="text-sm text-slate-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-slate-900">
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 text-purple-600">
                      <path d="M12 3 6 5v5c0 4 2.6 7.5 6 9 3.4-1.5 6-5 6-9V5l-6-2Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
                    </svg>
                    Required Permissions
                  </div>
                  <p className="mb-4 text-sm text-slate-600">Additional fine-grained permissions users must have (optional)</p>
                  <div className="space-y-3">
                    {allPermissionCodes.map((code) => (
                      <label key={code} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-4 py-4">
                        <input
                          type="checkbox"
                          checked={(editingAccessRule.permissions || []).includes(code)}
                          onChange={() => toggleEditingAccessRulePermission(code)}
                          className="h-5 w-5 rounded border-slate-300 accent-accent"
                        />
                        <span className="text-sm text-slate-700">{code}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </HoverScrollbar>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50/60 px-8 py-5">
              <button type="button" onClick={() => setEditingAccessRule(null)} className={secondaryButtonClass}>
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleSaveAccessRule(editingAccessRule);
                  setEditingAccessRule(null);
                }}
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800"
              >
                Save Rule
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCreateAccessRuleModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <div className={modalCardClass}>
            <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-8 py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Create Access Rule</h3>
                  <p className="mt-1 text-sm text-slate-600">Define route-level access control</p>
                </div>
                <button type="button" onClick={() => setShowCreateAccessRuleModal(false)} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Close">
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 text-slate-600">
                    <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateAccessRule}>
              <HoverScrollbar className="max-h-[70vh] px-8 py-6">
                <div className="space-y-8">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Route Path</span>
                    <SelectBar
                      value={accessRuleForm.path}
                      onChange={(event) => setAccessRuleForm((prev) => ({ ...prev, path: event.target.value }))}
                    >
                      {availableAccessRulePaths.map((path) => (
                        <option key={path} value={path}>
                          {path}
                        </option>
                      ))}
                    </SelectBar>
                  </label>
                  <div>
                    <p className="mb-4 text-sm font-bold uppercase tracking-[0.16em] text-slate-900">Allowed Roles</p>
                    <div className="grid grid-cols-2 gap-3">
                      {roleLabels.map(({ role, label }) => (
                        <label key={`new-${role}`} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-4 py-4">
                          <input
                            type="checkbox"
                            checked={(accessRuleForm.roles || []).includes(role)}
                            onChange={() => toggleAccessRuleFormRole(role)}
                            className="h-5 w-5 rounded border-slate-300 accent-slate-900"
                          />
                          <span className="text-sm text-slate-700">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-4 text-sm font-bold uppercase tracking-[0.16em] text-slate-900">Required Permissions</p>
                    <div className="space-y-3">
                      {allPermissionCodes.map((code) => (
                        <label key={`new-${code}`} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-4 py-4">
                          <input
                            type="checkbox"
                            checked={(accessRuleForm.permissions || []).includes(code)}
                            onChange={() => toggleAccessRuleFormPermission(code)}
                            className="h-5 w-5 rounded border-slate-300 accent-accent"
                          />
                          <span className="text-sm text-slate-700">{code}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </HoverScrollbar>

              <div className="flex justify-between border-t border-slate-200 bg-slate-50/60 px-8 py-5">
                <div className="text-sm text-rose-500">{accessRulesError}</div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowCreateAccessRuleModal(false)} className={secondaryButtonClass}>
                    Cancel
                  </button>
                  <button type="submit" disabled={accessRuleFormSaving} className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 disabled:opacity-50">
                    {accessRuleFormSaving ? "Saving..." : "Create Rule"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showCreateUserModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <div className={`${modalCardClass} max-w-3xl`}>
            <div className="border-b border-slate-200 bg-gradient-to-r from-purple-50 to-white px-8 py-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">Create New User</h3>
                <button type="button" onClick={() => setShowCreateUserModal(false)} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Close">
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 text-slate-600">
                    <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleCreate}>
              <div className="space-y-6 px-8 py-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-700">Username</span>
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
                        className="pr-32"
                      />
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                        @{emailDomain}
                      </span>
                    </div>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-700">Phone Number</span>
                    <InputBar
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={form.phoneNumber}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                        setForm((prev) => ({
                          ...prev,
                          phoneNumber: digits,
                          password: passwordEdited ? prev.password : digits
                        }));
                      }}
                      placeholder="1234567890"
                    />
                  </label>
                </div>
                <div className="grid gap-6 md:grid-cols-3">
                  <label className="block">
                    <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-700">Password</span>
                    <InputBar
                      type="password"
                      value={form.password}
                      onChange={(e) => {
                        setPasswordEdited(true);
                        setForm((prev) => ({ ...prev, password: e.target.value }));
                      }}
                      placeholder="Defaults to mobile number"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-700">Role</span>
                    <SelectBar
                      value={form.role}
                      onChange={(e) => {
                        const value = e.target.value;
                        const matchGroup = groups.find((g) => g.role === value);
                        setForm((prev) => ({
                          ...prev,
                          role: value,
                          groupId: matchGroup ? String(matchGroup.id) : prev.groupId,
                        }));
                      }}
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {toTitleCase(role)}
                        </option>
                      ))}
                    </SelectBar>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-700">Group</span>
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
                          {group.name}
                        </option>
                      ))}
                    </SelectBar>
                  </label>
                </div>
              </div>

              <div className="flex justify-between border-t border-slate-200 bg-slate-50/60 px-8 py-5">
                <div className="text-sm text-rose-500">{error}</div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowCreateUserModal(false)} className={secondaryButtonClass}>
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className={primaryButtonClass}>
                    {saving ? "Creating..." : "Create User"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showCreateGroupModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-[1.75rem] bg-white shadow-2xl">
            <div className="border-b border-slate-200 bg-gradient-to-r from-purple-50 to-white px-8 py-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">Create Group</h3>
                <button type="button" onClick={() => setShowCreateGroupModal(false)} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Close">
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 text-slate-600">
                    <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateGroup}>
              <div className="grid gap-6 px-8 py-6 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-700">Group Name</span>
                  <InputBar
                    type="text"
                    value={groupForm.name}
                    onChange={(e) => setGroupForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Group name"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-700">Role</span>
                  <SelectBar value={groupForm.role} onChange={(e) => setGroupForm((prev) => ({ ...prev, role: e.target.value }))}>
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {toTitleCase(role)}
                      </option>
                    ))}
                  </SelectBar>
                </label>
              </div>

              <div className="flex justify-between border-t border-slate-200 bg-slate-50/60 px-8 py-5">
                <div className="text-sm text-rose-500">{groupError}</div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowCreateGroupModal(false)} className={secondaryButtonClass}>
                    Cancel
                  </button>
                  <button type="submit" disabled={groupSaving} className={primaryButtonClass}>
                    {groupSaving ? "Creating..." : "Create Group"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {modalMode && modalUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">User Action</p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">
                  {modalMode === "password" ? "Reset password" : "Delete user"}
                </h3>
              </div>
              <button type="button" onClick={closeModal} className="text-sm text-slate-400 hover:text-slate-600" aria-label="Close dialog">
                x
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-gradient-to-r from-accent-soft to-white px-4 py-3 text-sm text-slate-600">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Selected User</p>
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
                  <button type="button" onClick={closeModal} className={secondaryButtonClass}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResetPassword(modalUser.id)}
                    disabled={passwordSavingId === modalUser.id}
                    className={primaryButtonClass}
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
                  <button type="button" onClick={closeModal} className={secondaryButtonClass}>
                    Cancel
                  </button>
                  {!deleteConfirmStep ? (
                    <button type="button" onClick={() => setDeleteConfirmStep(true)} className={dangerButtonClass}>
                      Continue
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(modalUser.id)}
                      disabled={deleteSavingId === modalUser.id}
                      className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
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
    </div>
  );
}
