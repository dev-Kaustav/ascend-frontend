// Local simulation engine. Produces the SAME response contract the n8n proxy
// returns, so the same UI renders both. Deterministic, no network, no OpenAI,
// no Google Sheets. orchestrator = 'local_simulation', dataSource = 'fixture'.
import { buildSkuSignals, parseOrderItems } from './reorder';
import { AS_OF_DATE, ordersForOutlet } from '../_data/orderHistory';
import { SKU_BY_CODE } from '../_data/skuMaster';
import { RETAILER_BY_ID } from '../_data/retailers';

function signalStatusFor(overdueRatio) {
  if (overdueRatio >= 1.0) return 'overdue';
  if (overdueRatio >= 0.9) return 'due';
  if (overdueRatio >= 0.8) return 'approaching';
  return 'on_cycle';
}

function evidenceFor(purchaseCount) {
  if (purchaseCount >= 5) return 'high';
  if (purchaseCount >= 3) return 'medium';
  return 'low';
}

function basketSummaryText(items) {
  return items.map((i) => `${i.skuName} – ${i.quantity} ${i.unit}${i.quantity > 1 ? 's' : ''}`).join('\n');
}

export function simulateAnalyse(req) {
  const retailer = RETAILER_BY_ID[req.outletId];
  if (!retailer) {
    return {
      executionId: req.executionId,
      orchestrator: 'local_simulation',
      dataSource: 'fixture',
      status: 'ERROR',
      error: { code: 'OUTLET_NOT_FOUND', message: `No outlet ${req.outletId} in the demo dataset.`, retryable: false },
    };
  }

  const orders = ordersForOutlet(req.outletId);
  const rawSignals = buildSkuSignals(orders, AS_OF_DATE);

  // SKU signals enriched to the contract shape (active SKUs only).
  const skuSignals = rawSignals
    .filter((s) => SKU_BY_CODE[s.skuCode]?.ACTIVE)
    .map((s) => {
      const sku = SKU_BY_CODE[s.skuCode];
      return {
        skuCode: s.skuCode,
        skuName: sku.SKU_NAME,
        brand: sku.BRAND,
        unit: sku.UNIT,
        retailerPrice: sku.RETAILER_PRICE,
        purchaseCount: s.purchaseDates.length,
        typicalCycleDays: s.medianIntervalDays,
        daysSinceLastPurchase: s.daysSinceLast,
        signalStatus: signalStatusFor(s.overdueRatio),
        suggestedQuantity: s.medianQty,
        evidenceStrength: evidenceFor(s.purchaseDates.length),
      };
    });

  const due = skuSignals.filter((s) => s.signalStatus === 'overdue' || s.signalStatus === 'due');

  const items = due.map((s) => ({
    skuCode: s.skuCode,
    skuName: s.skuName,
    quantity: s.suggestedQuantity,
    unit: s.unit,
    retailerPrice: s.retailerPrice,
    lineValue: Math.round(s.retailerPrice * s.suggestedQuantity),
  }));
  const basketValue = items.reduce((sum, i) => sum + i.lineValue, 0);
  const basketSummary = basketSummaryText(items);

  // Mirror n8n: confidence from evidence depth + how overdue, expressed 0..1.
  const maxOverdue = due.length ? Math.max(...rawSignals.map((s) => s.overdueRatio)) : 0;
  const depth = Math.min(1, Math.max(0, ...skuSignals.map((s) => s.purchaseCount)) / 6);
  const confidence = Math.min(0.96, 0.6 + 0.25 * Math.min(1, maxOverdue / 1.3) + 0.13 * depth);

  const decision = items.length > 0 ? 'RECOMMEND_REORDER' : 'NO_REORDER';
  const businessReason =
    items.length > 0
      ? 'Recurring SKUs have reached their historical reorder windows, based on delivered-order frequency.'
      : 'No recurring SKU has reached its reorder window yet, based on delivered-order history.';

  const analysisFacts = {
    deliveredOrderCount: orders.length,
    validLineItemCount: orders.reduce((sum, o) => sum + parseOrderItems(o.orderItems).length, 0),
    recurringSkuCount: skuSignals.length,
  };

  const trace = [
    { step: 'Normalise Request', type: 'CODE', status: 'completed' },
    { step: 'Load Demo Data', type: 'FIXTURE', status: 'completed', detail: 'Temporary fixture source — Google Sheets to be connected.' },
    { step: 'Order Parser', type: 'CODE', status: 'completed', detail: `${analysisFacts.validLineItemCount} line items parsed.` },
    { step: 'Calculate Reorder Signals', type: 'CODE', status: 'completed', detail: `${skuSignals.length} recurring SKU(s).` },
    { step: 'Reorder Decision Agent', type: 'AI', status: 'completed', detail: businessReason },
    { step: 'Validate Reorder Basket', type: 'TOOL', status: 'completed' },
    { step: 'Validate Final Recommendation', type: 'CODE', status: 'completed' },
    { step: 'Human Approval Guard', type: 'HUMAN', status: 'awaiting_approval' },
  ];

  return {
    executionId: req.executionId,
    orchestrator: 'local_simulation',
    dataSource: 'fixture',
    status: 'AWAITING_HUMAN_APPROVAL',
    retailer: {
      outletId: retailer.outletId,
      retailerName: retailer.name,
      location: retailer.location,
      phoneMasked: retailer.phoneMasked,
      preferredLanguage: retailer.preferredLanguage,
      paymentPreference: retailer.paymentPreference,
      darkStore: retailer.darkStore,
    },
    analysisFacts,
    skuSignals,
    recommendation: {
      decision,
      confidence: Math.round(confidence * 100) / 100,
      businessReason,
      selectedItems: items.map((i) => ({ skuCode: i.skuCode, quantity: i.quantity })),
    },
    basket: { items, basketSummary, basketValue },
    templateVariables: {
      retailerName: retailer.name,
      basketSummary,
      basketValue: String(basketValue),
    },
    trace,
  };
}
