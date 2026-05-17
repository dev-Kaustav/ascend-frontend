export const DEFAULT_WORKSPACE_ACCESS_RULES = [
  { path: "/app/dashboard", roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE_MANAGER", "SALESMAN", "DRIVER", "BRAND", "RETAILER"], permissions: [] },
  { path: "/app/orders", roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE_MANAGER", "SALESMAN", "DRIVER", "RETAILER"], permissions: [] },
  { path: "/app/orders/new", roles: ["ADMIN", "ACCOUNTANT", "SALESMAN"], permissions: [] },
  { path: "/app/orders/:orderId", roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE_MANAGER", "SALESMAN", "DRIVER", "RETAILER"], permissions: [] },
  { path: "/app/operations", roles: ["ADMIN", "WAREHOUSE_MANAGER"], permissions: [] },
  { path: "/app/operations/inventory/add", roles: ["ADMIN", "WAREHOUSE_MANAGER"], permissions: ["inventory.manage"] },
  { path: "/app/finance", roles: ["ADMIN", "ACCOUNTANT"], permissions: [] },
  { path: "/app/master-data", roles: ["ADMIN"], permissions: [] },
  { path: "/app/imports", roles: ["ADMIN"], permissions: [] },
  { path: "/app/admin", roles: ["ADMIN"], permissions: [] },
  { path: "/app/profile", roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE_MANAGER", "BRAND", "RETAILER"], permissions: [] },
  { path: "/app/bill-labels", roles: ["ADMIN", "ACCOUNTANT"], permissions: [] },
  { path: "/app/outlet-finder", roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE_MANAGER", "SALESMAN", "DRIVER", "BRAND", "RETAILER"], permissions: [] },
  { path: "/app/admin/tracking", roles: ["ADMIN"], permissions: [] },
];

export const MANAGED_ACCESS_RULE_PATHS = new Set(DEFAULT_WORKSPACE_ACCESS_RULES.map((rule) => rule.path));

const REMOVED_LEGACY_PREFIXES = [
  "/app/inventory",
  "/app/drivers",
  "/app/salesmen",
  "/app/retail-coverage",
  "/app/accounting",
  "/app/invoices",
  "/app/credit-notes",
  "/app/cash-collection",
  "/app/brands",
  "/app/catalog",
  "/app/users",
  "/app/create"
];

export function mergeDefaultWorkspaceAccessRules(rules = []) {
  const normalized = Array.isArray(rules) ? [...rules] : [];
  const paths = new Set(normalized.map((rule) => rule.path));
  DEFAULT_WORKSPACE_ACCESS_RULES.forEach((rule) => {
    if (!paths.has(rule.path)) {
      normalized.push({ ...rule });
    }
  });
  return normalized;
}

export function filterManagedAccessRules(rules = []) {
  return (Array.isArray(rules) ? rules : []).filter((rule) => MANAGED_ACCESS_RULE_PATHS.has(rule.path));
}

export function isRemovedLegacyPath(pathname) {
  if (!pathname) return false;
  return REMOVED_LEGACY_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
