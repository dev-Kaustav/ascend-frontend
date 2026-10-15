export const WORKSPACE_ROLE_RULES = [
  { path: "/app/dashboard", roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE_MANAGER", "SALESMAN", "DRIVER", "BRAND"] },
  { path: "/app/orders", roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE_MANAGER", "SALESMAN", "DRIVER"] },
  { path: "/app/orders/new", roles: ["ADMIN", "ACCOUNTANT", "SALESMAN"] },
  { path: "/app/orders/:orderId", roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE_MANAGER", "SALESMAN", "DRIVER"] },
  { path: "/app/operations", roles: ["ADMIN", "WAREHOUSE_MANAGER"] },
  { path: "/app/operations/inventory/add", roles: ["ADMIN", "WAREHOUSE_MANAGER"] },
  { path: "/app/finance", roles: ["ADMIN", "ACCOUNTANT"] },
  { path: "/app/master-data", roles: ["ADMIN"] },
  { path: "/app/retailers", roles: ["ADMIN", "ACCOUNTANT", "SALESMAN"] },
  { path: "/app/retailer-requests", roles: ["ADMIN"] },
  { path: "/app/imports", roles: ["ADMIN"] },
  { path: "/app/admin", roles: ["ADMIN"] },
  { path: "/app/profile", roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE_MANAGER", "SALESMAN", "DRIVER", "BRAND"] },
  { path: "/app/bill-labels", roles: ["ADMIN", "ACCOUNTANT"] },
  { path: "/app/outlet-finder", roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE_MANAGER", "SALESMAN", "DRIVER", "BRAND"] },
];

function isPathMatch(pattern, pathname) {
  if (!pattern || !pathname) return false;
  if (pattern.includes(":")) {
    const regexSource = pattern.replace(/:([^/]+)/g, "[^/]+");
    return new RegExp(`^${regexSource}$`).test(pathname);
  }
  return pathname === pattern || pathname.startsWith(`${pattern}/`);
}

export function getWorkspaceRuleForPath(pathname) {
  return WORKSPACE_ROLE_RULES.reduce((matched, rule) => {
    if (!isPathMatch(rule.path, pathname)) return matched;
    if (!matched) return rule;
    const ruleScore = rule.path === pathname ? 3 : rule.path.includes(":") ? 2 : 1;
    const matchedScore = matched.path === pathname ? 3 : matched.path.includes(":") ? 2 : 1;
    if (ruleScore > matchedScore || (ruleScore === matchedScore && rule.path.length > matched.path.length)) {
      return rule;
    }
    return matched;
  }, null);
}

export function roleCanManageInventory(role) {
  return role === "ADMIN" || role === "WAREHOUSE_MANAGER";
}
