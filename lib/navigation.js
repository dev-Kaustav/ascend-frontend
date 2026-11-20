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
  ],
  // Outlet Finder is a field tool: it stays in the salesman and driver apps and is still
  // reachable at /app/outlet-finder, but is not in the office roles' menus (2026-11-17).
  ACCOUNTANT: [
    { label: "Dashboard", href: "/app/dashboard" },
    { label: "Orders", href: "/app/orders" },
    { label: "Retailers", href: "/app/retailers" },
    { label: "Finance", href: "/app/finance" },
    { label: "Bill Labels", href: "/app/bill-labels" },
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

// Below the desktop breakpoint these roles get the app shell (FieldMobileNavigation: an app header
// and bottom tabs) instead of the sidebar behind a menu button.
export function usesAppShell(role) {
  return isFieldRole(role) || role === "ADMIN" || role === "ACCOUNTANT";
}

// The office has more sections than a tab bar holds: the four it works in most are tabs, the rest
// sit under More (getMoreNavForRole) with the account.
const OFFICE_TABS = ["Dashboard", "Orders", "Retailers", "Finance"];

/** The bottom tabs for a role on the app shell. An office role's last tab is More (no href). */
export function getFieldNavForRole(role) {
  if (!usesAppShell(role)) return [];
  if (!isFieldRole(role)) {
    return [
      ...getNavForRole(role)
        .filter((item) => OFFICE_TABS.includes(item.label))
        .map((item) => ({ ...item, label: item.label === "Dashboard" ? "Home" : item.label })),
      { label: "More", href: null }
    ];
  }
  const labels = {
    Dashboard: "Home",
    Orders: role === "DRIVER" ? "Deliveries" : "Orders",
    "My Retailers": "Retailers",
    "Outlet Finder": role === "DRIVER" ? "Routes" : role === "SALESMAN" ? "Find" : "Outlets"
  };
  return [
    ...getNavForRole(role).map((item) => ({ ...item, label: labels[item.label] || item.label })),
    { label: "Account", href: "/app/profile" }
  ];
}

/** What an office role's More tab opens: the sections that are not tabs, then the account. */
export function getMoreNavForRole(role) {
  if (!usesAppShell(role) || isFieldRole(role)) return [];
  return [
    ...getNavForRole(role).filter((item) => !OFFICE_TABS.includes(item.label)),
    { label: "Account", href: "/app/profile" }
  ];
}

// Screens below a tab: the title the app header shows, and where its back arrow goes when the
// screen was opened straight from a link. The first match wins, so /new comes before an id.
const CHILD_SCREENS = [
  { prefix: "/app/orders/new", title: "New order", parent: "/app/orders" },
  { prefix: "/app/orders/", title: "Order details", parent: "/app/orders" },
  { prefix: "/app/retailers/beats/", title: "Beat", parent: "/app/retailers?view=beats" },
  { prefix: "/app/retailers/", title: "Shop", parent: "/app/retailers" }
];

export function getChildScreen(pathname) {
  return CHILD_SCREENS.find((screen) => pathname === screen.prefix || pathname.startsWith(screen.prefix)) || null;
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
