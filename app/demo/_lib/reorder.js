// Reorder / replenishment math — grounded in delivered order history + SKU Master.
// Pure and deterministic. The language is about PURCHASE FREQUENCY, never real
// shelf inventory: we infer "likely replenishment due", not "stockout".

export function parseOrderItems(encoded) {
  return encoded
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [skuCode, qty] = part.split('*');
      return { skuCode: skuCode.trim(), quantity: Number(qty) || 0 };
    })
    .filter((p) => p.skuCode && p.quantity > 0);
}

function median(nums) {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function daysBetween(aIso, bIso) {
  const a = new Date(aIso + 'T00:00:00').getTime();
  const b = new Date(bIso + 'T00:00:00').getTime();
  return Math.round((a - b) / 86_400_000);
}

export function buildSkuSignals(orders, asOfDate) {
  const delivered = orders
    .filter((o) => o.status === 'delivered')
    .sort((a, b) => (a.orderDate < b.orderDate ? 1 : -1));

  const bySku = new Map();
  for (const o of delivered) {
    for (const it of parseOrderItems(o.orderItems)) {
      const entry = bySku.get(it.skuCode) ?? { dates: [], qtys: [] };
      entry.dates.push(o.orderDate);
      entry.qtys.push(it.quantity);
      bySku.set(it.skuCode, entry);
    }
  }

  const signals = [];
  for (const [skuCode, { dates, qtys }] of bySku) {
    if (dates.length < 2) continue;
    const intervals = [];
    for (let i = 0; i < dates.length - 1; i++) intervals.push(daysBetween(dates[i], dates[i + 1]));
    const medianInterval = median(intervals);
    const daysSinceLast = daysBetween(asOfDate, dates[0]);
    signals.push({
      skuCode,
      purchaseDates: dates,
      quantities: qtys,
      medianIntervalDays: medianInterval,
      daysSinceLast,
      medianQty: Math.max(1, Math.round(median(qtys.slice(0, 3)))),
      overdueRatio: medianInterval > 0 ? daysSinceLast / medianInterval : 0,
    });
  }
  return signals.sort((a, b) => b.overdueRatio - a.overdueRatio);
}

function riskFromOverdue(maxOverdue) {
  if (maxOverdue >= 1.1) return 'high';
  if (maxOverdue >= 0.85) return 'medium';
  return 'low';
}

export function computeRecommendation(orders, skuByCode, asOfDate) {
  const signals = buildSkuSignals(orders, asOfDate);
  const dueSignals = signals.filter((s) => {
    const sku = skuByCode[s.skuCode];
    return sku && sku.ACTIVE && s.overdueRatio >= 0.8;
  });

  const items = dueSignals.map((s) => {
    const sku = skuByCode[s.skuCode];
    const quantity = s.medianQty;
    const lineValue = Math.round(sku.RETAILER_PRICE * quantity);
    return {
      skuCode: s.skuCode, skuName: sku.SKU_NAME, brand: sku.BRAND,
      quantity, unit: sku.UNIT, retailerPrice: sku.RETAILER_PRICE, lineValue,
    };
  });

  const expectedOrderValue = items.reduce((sum, i) => sum + i.lineValue, 0);
  const maxOverdue = dueSignals.length ? dueSignals[0].overdueRatio : signals[0]?.overdueRatio ?? 0;
  const riskLevel = riskFromOverdue(maxOverdue);

  const historyDepth = Math.min(1, signals.reduce((m, s) => Math.max(m, s.purchaseDates.length), 0) / 6);
  const overdueClarity = Math.min(1, maxOverdue / 1.3);
  const confidence = Math.round(60 + 25 * overdueClarity + 13 * historyDepth);

  const reasons = [];
  const reasonCodes = [];
  for (const s of dueSignals.slice(0, 3)) {
    const sku = skuByCode[s.skuCode];
    reasons.push(
      `${sku.SKU_NAME}: last purchased ${s.daysSinceLast} days ago; typical reorder every ~${s.medianIntervalDays} days (based on historical purchase frequency).`,
    );
    reasonCodes.push(`REORDER_WINDOW_EXCEEDED:${s.skuCode}`);
  }
  if (reasons.length === 0) {
    reasons.push('No SKU has clearly crossed its reorder window yet — retailer appears on cycle.');
    reasonCodes.push('ON_CYCLE');
  }

  const estimatedLostSales = Math.round(expectedOrderValue * Math.min(0.6, 0.3 * maxOverdue));

  return {
    riskLevel,
    confidence: Math.min(97, confidence),
    reasonCodes, reasons, items, expectedOrderValue, estimatedLostSales,
    deliveryEstimate: '3 hours 32 minutes',
    signals,
  };
}
