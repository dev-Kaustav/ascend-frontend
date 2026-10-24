export const NAV_CONFIG = {
  ADMIN: [
    { label: "Dashboard", href: "/app/dashboard" },
    { label: "Orders", href: "/app/orders" },
    { label: "Retailers", href: "/app/retailers" },
    { label: "Inventory", href: "/app/operations" },
    { label: "Finance", href: "/app/finance" },
    { label: "Catalog", href: "/app/master-data" },
    { label: "Imports", href: "/app/imports" },
    { label: "Admin", href: "/app/admin" },
    { label: "Bill Labels", href: "/app/bill-labels" },
    { label: "Outlet Finder", href: "/app/outlet-finder" },
  ],
  ACCOUNTANT: [
    { label: "Dashboard", href: "/app/dashboard" },
    { label: "Orders", href: "/app/orders" },
    { label: "Retailers", href: "/app/retailers" },
    { label: "Finance", href: "/app/finance" },
    { label: "Bill Labels", href: "/app/bill-labels" },
    { label: "Outlet Finder", href: "/app/outlet-finder" },
  ],
  WAREHOUSE_MANAGER: [
    { label: "Dashboard", href: "/app/dashboard" },
    { label: "Orders", href: "/app/orders" },
    { label: "Inventory", href: "/app/operations" },
    { label: "Outlet Finder", href: "/app/outlet-finder" },
  ],
  SALESMAN: [
    { label: "Dashboard", href: "/app/dashboard" },
    { label: "Orders", href: "/app/orders" },
    { label: "My Retailers", href: "/app/retailers" },
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

export function isFieldRole(role) {
  return ["SALESMAN", "DRIVER", "WAREHOUSE_MANAGER"].includes(role);
}

export function getFieldNavForRole(role) {
  if (!isFieldRole(role)) return [];
  const labels = {
    Dashboard: "Home",
    Orders: role === "DRIVER" ? "Deliveries" : "Orders",
    "My Retailers": "Retailers",
    "Outlet Finder": role === "DRIVER" ? "Routes" : "Outlets"
  };
  return [
    ...getNavForRole(role).map((item) => ({ ...item, label: labels[item.label] || item.label })),
    { label: "Account", href: "/app/profile" }
  ];
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
