// One vocabulary for order states on the staff desktop: the queue, the order desk and their pills.
// Words describe the work ("To accept", "Needs rider"), not the enum.

export const STATUS_LABEL = {
  PENDING: "To accept",
  READY_TO_SHIP: "Needs rider",
  DRIVER_ASSIGNED: "Awaiting rider",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
};

// Amber marks the two states that need an office action.
export const STATUS_TONE = {
  PENDING: "bg-amber-100 text-amber-900",
  READY_TO_SHIP: "bg-amber-100 text-amber-900",
  DRIVER_ASSIGNED: "bg-[#eeeeee] text-[#3d3d3d]",
  OUT_FOR_DELIVERY: "bg-[#eeeeee] text-[#3d3d3d]",
  DELIVERED: "bg-[#dcfae5] text-[#04250e]",
  RETURNED: "bg-[#fffbeb] text-[#92400e]",
  CANCELLED: "bg-[#ffedea] text-[#831c1e]",
};

export const PAYMENT_LABEL = { PAID: "Paid", PARTIAL: "Part paid", CREDIT: "On credit", UNPAID: "Unpaid" };
export const PAYMENT_TONE = {
  PAID: "bg-[#dcfae5] text-[#04250e]",
  PARTIAL: "bg-[#fffbeb] text-[#92400e]",
  CREDIT: "bg-[#eeeeee] text-[#3d3d3d]",
  UNPAID: "bg-[#eeeeee] text-[#3d3d3d]",
};

export function statusLabel(status) {
  return STATUS_LABEL[status] || status || "—";
}

// The road an order travels, for the progress strip. Cancelled and returned interrupt it. The
// office sends an accepted order out with a rider in one step; DRIVER_ASSIGNED (a rider pickup
// step, since removed) survives only in old order history, labelled above.
export const ORDER_STEPS = [
  { status: "PENDING", label: "Placed" },
  { status: "READY_TO_SHIP", label: "Accepted" },
  { status: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  { status: "DELIVERED", label: "Delivered" },
];

// The orders screen starts with all orders, then follows the work through its queues. `count` reads the
// /admin/orders/status-summary response; `filter` is the list query for the queue.
export const ORDER_QUEUES = [
  {
    key: "all",
    label: "All orders",
    // Every order that is not cancelled, counted by the server.
    count: (s) => s.ALL || 0,
    filter: {},
  },
  { key: "to-accept", label: "To accept", count: (s) => s.PENDING || 0, filter: { status: "PENDING" } },
  { key: "needs-rider", label: "Needs rider", count: (s) => s.READY_TO_SHIP || 0, filter: { status: "READY_TO_SHIP" } },
  { key: "on-the-road", label: "Out for delivery", count: (s) => s.OUT_FOR_DELIVERY || 0, filter: { status: "OUT_FOR_DELIVERY" } },
  { key: "payment-due", label: "Payment due", count: (s) => s.PAYMENT_DUE || 0, filter: { payment_status: "DUE" } },
];
