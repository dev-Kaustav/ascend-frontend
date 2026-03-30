export const NAV_CONFIG = {
  ADMIN: [
    { label: "Dashboard", href: "/app/dashboard" },
    { label: "Orders", href: "/app/orders" },
    { label: "Inventory", href: "/app/inventory", permissions: ["inventory.view"] },
    { label: "Accounting", href: "/app/accounting" },
    { label: "Users", href: "/app/users" },
    { label: "Brands", href: "/app/brands" },
    { label: "Catalog", href: "/app/catalog" },
    { label: "Create", href: "/app/create" },
    { label: "Cash Collection", href: "/app/cash-collection" },
    { label: "Retail Coverage", href: "/app/retail-coverage" },
    { label: "Salesmen", href: "/app/salesmen" },
    { label: "Drivers", href: "/app/drivers" },
    { label: "Invoices", href: "/app/invoices" },
    { label: "Credit Notes", href: "/app/credit-notes" },
    { label: "Profile", href: "/app/profile" }
  ],
  ACCOUNTANT: [
    { label: "Dashboard", href: "/app/dashboard" },
    { label: "Orders", href: "/app/orders" },
    { label: "Accounting", href: "/app/accounting" },
    { label: "Profile", href: "/app/profile" }
  ],
  WAREHOUSE_MANAGER: [
    { label: "Dashboard", href: "/app/dashboard" },
    { label: "Orders", href: "/app/orders" },
    { label: "Inventory", href: "/app/inventory", permissions: ["inventory.view"] },
    { label: "Drivers", href: "/app/drivers" },
    { label: "Profile", href: "/app/profile" }
  ],
  BRAND: [
    { label: "Dashboard", href: "/app/dashboard" },
    { label: "Profile", href: "/app/profile" }
  ],
  RETAILER: [
    { label: "Dashboard", href: "/app/dashboard" },
    { label: "Profile", href: "/app/profile" }
  ]
};

export function getNavForRole(role) {
  return NAV_CONFIG[role] || [];
}

export function filterNavByPermissions(navItems, { hasPermission, loading }) {
  return navItems.filter((item) => {
    if (!item.permissions?.length) return true;
    if (!hasPermission || loading) return false;
    return item.permissions.every((code) => hasPermission(code));
  });
}

export function getRoleLabel(role) {
  if (role === "ADMIN") return "Admin";
  if (role === "ACCOUNTANT") return "Accountant";
  if (role === "WAREHOUSE_MANAGER") return "Warehouse";
  if (role === "BRAND") return "Brand";
  if (role === "RETAILER") return "Retailer";
  if (role === "SALESMAN") return "Salesman";
  if (role === "DRIVER") return "Driver";
  return "User";
}
