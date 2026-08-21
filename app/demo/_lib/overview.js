// Single source of truth for the Command Centre aggregates.
// Everything is DERIVED from the retailer dataset — no hardcoded headline numbers.
// In Live mode you pass the retailers fetched from Google Sheets / n8n here and
// the same maths produces real figures (add rows → the counts grow automatically).
import { DEMO_RETAILERS } from '../_data/retailers';

const DUE = new Set(['window_exceeded', 'likely_due']);
const AWAITING = new Set(['whatsapp_sent', 'awaiting_reply']);

export function computeOverview(retailers = DEMO_RETAILERS) {
  const count = (pred) => retailers.filter(pred).length;

  const total = retailers.length;
  const due = retailers.filter((r) => DUE.has(r.state));
  const dueCount = due.length;
  const awaitingCount = count((r) => AWAITING.has(r.state));
  const callCount = count((r) => r.state === 'call_requested');
  const confirmedCount = count((r) => r.state === 'order_confirmed');
  const declinedCount = count((r) => r.state === 'declined');
  const onCycleCount = count((r) => r.state === 'on_cycle');

  // Estimated recoverable GMV = sum of due retailers' average basket value.
  const recoverableGMV = due.reduce((sum, r) => sum + r.avgBasketValue, 0);
  const darkStores = new Set(retailers.map((r) => r.darkStore)).size;
  const darkStoreNames = [...new Set(retailers.map((r) => r.darkStore))].join(', ');

  // Pipeline breakdown of the actual dataset (drives the chart).
  const pipeline = [
    { label: 'Likely due', v: dueCount },
    { label: 'WhatsApp sent', v: awaitingCount },
    { label: 'Call requested', v: callCount },
    { label: 'Confirmed', v: confirmedCount },
    { label: 'Declined', v: declinedCount },
    { label: 'On cycle', v: onCycleCount },
  ];

  return {
    total, dueCount, awaitingCount, callCount, confirmedCount, declinedCount, onCycleCount,
    recoverableGMV, darkStores, darkStoreNames, pipeline,
  };
}
