// Fixed "today" for the deterministic demo so the story never drifts.
export const AS_OF_DATE = '2026-06-17';

function daysAgo(n, from = AS_OF_DATE) {
  const d = new Date(from + 'T00:00:00');
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function order(outletId, dAgo, items, billValue) {
  return { outletId, orderDate: daysAgo(dAgo), status: 'delivered', orderItems: items, billValue };
}

const sharma = [
  order('RET-1027', 6, 'CRAX_RING_20*2,JAB_CHANA_200*1,CRAX_CURLS_30*1', 2360),
  order('RET-1027', 11, 'CRAX_RING_20*2,JAB_CHANA_200*1', 2210),
  order('RET-1027', 16, 'CRAX_RING_20*2,JAB_CHANA_200*1,CRAX_CURLS_30*1', 2480),
  order('RET-1027', 22, 'CRAX_RING_20*3,JAB_CHANA_200*1,CRAX_CURLS_30*1', 3100),
  order('RET-1027', 27, 'CRAX_RING_20*2,JAB_CHANA_200*1', 2150),
  order('RET-1027', 33, 'CRAX_RING_20*2,JAB_CHANA_200*2,CRAX_CURLS_30*1', 3250),
  order('RET-1027', 38, 'CRAX_RING_20*2,JAB_CHANA_200*1,CRAX_CURLS_30*1', 2390),
  order('RET-1027', 44, 'CRAX_RING_20*2,JAB_CHANA_200*1', 2280),
];

const others = [
  order('RET-1043', 9, 'CRAX_NATKHAT_25*2,JAB_PEANUT_180*1', 1620),
  order('RET-1043', 17, 'CRAX_NATKHAT_25*2,JAB_PEANUT_180*1,CRAX_FRITZ_45*1', 2210),
  order('RET-1043', 25, 'CRAX_NATKHAT_25*2,JAB_PEANUT_180*1', 1600),
  order('RET-1043', 34, 'CRAX_NATKHAT_25*3,JAB_PEANUT_180*1', 1980),
  order('RET-1088', 2, 'CRAX_RING_20*1,CRAX_CURLS_30*1', 1360),
  order('RET-1088', 10, 'CRAX_RING_20*1,CRAX_CURLS_30*1,JAB_CASHEW_100*1', 2540),
  order('RET-1088', 19, 'CRAX_RING_20*1,CRAX_CURLS_30*1', 1360),
];

export const ORDER_HISTORY = [...sharma, ...others];

export function ordersForOutlet(outletId) {
  return ORDER_HISTORY.filter((o) => o.outletId === outletId && o.status === 'delivered').sort(
    (a, b) => (a.orderDate < b.orderDate ? 1 : -1),
  );
}
