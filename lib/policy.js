// What each role may do, in one table. Every screen asks `can()` (and, for orders, `nextStep()`)
// instead of testing role names itself, so a permission changes here and nowhere else.
//
// The order rules mirror _ALLOWED_TRANSITIONS in ascend-backend/app/services/order.py. The server
// stays the gatekeeper; this only decides what a screen offers.

// The next step from each status: what the button says and where it moves the order. Sending out
// needs a rider; delivering carries the payment taken at the door.
export const ORDER_STEP = {
  PENDING: { label: "Accept order", nextStatus: "READY_TO_SHIP" },
  READY_TO_SHIP: { label: "Assign rider & send out", nextStatus: "OUT_FOR_DELIVERY", needs: "rider" },
  OUT_FOR_DELIVERY: { label: "Mark delivered", nextStatus: "DELIVERED", needs: "payment" },
};

const ALL_OPEN = ["PENDING", "READY_TO_SHIP", "OUT_FOR_DELIVERY"];

// advance: statuses the role can move forward. cancel: statuses the role can cancel from.
// The rest are yes/no:
//   orderDesk: at a desk the role works orders from the dense office view (OrderDesk);
//   addRetailer: may add a shop (a salesman's goes through retailer requests, assigned to them);
//   manageRetailers: sees every shop with its salesman and beat, and edits and assigns them;
//   seeOutstanding: what shops owe.
const POLICY = {
  ADMIN: {
    advance: ALL_OPEN, cancel: ALL_OPEN, downloadPdf: true, createOrder: true, pickSalesman: true, orderDesk: true, exportOrders: true,
    addRetailer: true, manageRetailers: true, seeOutstanding: true,
  },
  ACCOUNTANT: {
    advance: [], cancel: [], downloadPdf: true, createOrder: true, pickSalesman: true, orderDesk: true, exportOrders: true,
    seeOutstanding: true,
  },
  WAREHOUSE_MANAGER: { advance: ["PENDING", "READY_TO_SHIP"], cancel: ["READY_TO_SHIP"], downloadPdf: true, orderDesk: true },
  SALESMAN: { advance: [], cancel: [], downloadPdf: true, createOrder: true, collectCash: true, addRetailer: true },
  DRIVER: { advance: ["OUT_FOR_DELIVERY"], cancel: ["OUT_FOR_DELIVERY"] },
  RETAILER: { advance: [], cancel: ["PENDING", "READY_TO_SHIP"] },
};

/**
 * Whether `role` may do `action`. Order actions take the order:
 *   advance, cancel: by its status;
 *   downloadPdf: an order cancelled before dispatch has no document;
 *   collectCash: the server says whether this order still has cash to collect (can_collect_cash).
 * Every other action is role-wide and takes no order.
 */
export function can(role, action, order = null) {
  const rules = POLICY[role];
  if (!rules) return false;
  switch (action) {
    case "advance":
      return Boolean(order && ORDER_STEP[order.status] && rules.advance.includes(order.status));
    case "cancel":
      return Boolean(order && rules.cancel.includes(order.status));
    case "downloadPdf":
      return Boolean(rules.downloadPdf && order && (order.invoice_number || order.status !== "CANCELLED"));
    case "collectCash":
      return Boolean(rules.collectCash && order?.can_collect_cash);
    default:
      return Boolean(rules[action]);
  }
}

/** The step this role can take on this order now, or null. */
export function nextStep(role, order) {
  return can(role, "advance", order) ? ORDER_STEP[order.status] : null;
}

/** Whether any step this role can take needs a rider chosen, so the rider list is worth fetching. */
export function needsRiderList(role) {
  return (POLICY[role]?.advance || []).some((status) => ORDER_STEP[status]?.needs === "rider");
}

/** What cancelling is called at this point: at the door it is the shop refusing. */
export function cancelLabel(order) {
  return order.status === "OUT_FOR_DELIVERY" ? "Refused at shop" : "Cancel order";
}
