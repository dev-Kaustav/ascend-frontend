export const NAV_CONFIG = {
  ADMIN: [
    { label: "Dashboard", href: "/app/dashboard" },
    { label: "Orders", href: "/app/orders" },
    { label: "Operations", href: "/app/operations" },
    { label: "Finance", href: "/app/finance" },
    { label: "Master Data", href: "/app/master-data" },
    { label: "Imports", href: "/app/imports" },
    { label: "Admin", href: "/app/admin" },
    { label: "Bill Labels", href: "/app/bill-labels" },
    { label: "Outlet Finder", href: "/app/outlet-finder" },
  ],
  ACCOUNTANT: [
    { label: "Dashboard", href: "/app/dashboard" },
    { label: "Orders", href: "/app/orders" },
    { label: "Finance", href: "/app/finance" },
    { label: "Bill Labels", href: "/app/bill-labels" },
    { label: "Outlet Finder", href: "/app/outlet-finder" },
  ],
  WAREHOUSE_MANAGER: [
    { label: "Dashboard", href: "/app/dashboard" },
    { label: "Orders", href: "/app/orders" },
    { label: "Operations", href: "/app/operations" },
    { label: "Outlet Finder", href: "/app/outlet-finder" },
  ],
  SALESMAN: [
    { label: "Dashboard", href: "/app/dashboard" },
    { label: "Orders", href: "/app/orders" },
    { label: "Outlet Finder", href: "/app/outlet-finder" },
  ],
  DRIVER: [
    { label: "Dashboard", href: "/app/dashboard" },
    { label: "Orders", href: "/app/orders" },
    { label: "Outlet Finder", href: "/app/outlet-finder" },
  ],
  BRAND: [
    { label: "Dashboard", href: "/app/dashboard" },
    { label: "Outlet Finder", href: "/app/outlet-finder" },
  ],
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
