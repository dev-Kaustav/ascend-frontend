export const adminNav = [
  {
    label: "Overview",
    href: "/app/admin/dashboard"
  },
  {
    label: "Orders",
    href: "/app/admin/orders"
  },
  {
    label: "Inventory",
    href: "/app/admin/inventory"
  },
  {
    label: "Catalog",
    href: "/app/admin/catalog"
  },
  {
    label: "Accounting",
    href: "/app/admin/accounting"
  },
  {
    label: "Retail Coverage",
    href: "/app/admin/retail-coverage"
  },
  {
    label: "Cash Collection",
    href: "/app/admin/cash-collection"
  },
  {
    label: "Salesmen",
    href: "/app/admin/salesmen"
  },
  {
    label: "Drivers",
    href: "/app/admin/drivers"
  },
  {
    label: "Invoices",
    href: "/app/admin/invoices"
  },
  {
    label: "Credit Notes",
    href: "/app/admin/credit-notes"
  },
  {
    label: "Users",
    href: "/app/admin/users"
  },
  {
    label: "Create",
    href: "/app/admin/create"
  },
  {
    label: "Profile",
    href: "/app/profile"
  }
];

export const brandNav = [
  {
    label: "Overview",
    href: "/app/brand/dashboard"
  },
  {
    label: "Profile",
    href: "/app/profile"
  }
];

export const accountantNav = [
  {
    label: "Overview",
    href: "/app/accountant/dashboard"
  },
  {
    label: "Orders",
    href: "/app/accountant/orders"
  },
  {
    label: "New Order",
    href: "/app/accountant/orders/new"
  },
  {
    label: "Profile",
    href: "/app/profile"
  }
];

export const warehouseNav = [
  {
    label: "Overview",
    href: "/app/warehouse/dashboard"
  },
  {
    label: "Orders",
    href: "/app/warehouse/orders"
  },
  {
    label: "Drivers",
    href: "/app/warehouse/drivers"
  },
  {
    label: "Profile",
    href: "/app/profile"
  }
];

export const retailerNav = [
  {
    label: "Overview",
    href: "/app/retailer/dashboard"
  },
  {
    label: "Profile",
    href: "/app/profile"
  }
];

export const navByRole = {
  ADMIN: adminNav,
  ACCOUNTANT: accountantNav,
  WAREHOUSE_MANAGER: warehouseNav,
  BRAND: brandNav,
  RETAILER: retailerNav
};

export function getNavForRole(role) {
  return navByRole[role] || [];
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
