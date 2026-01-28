export const createEmptyOrderItem = () => ({
  skuId: "",
  quantity: "",
  unitPrice: "",
  discount: "0"
});

export const getSkuGstRate = (sku) => {
  const sgst = Number(sku?.sgst_percent) || 0;
  const cgst = Number(sku?.cgst_percent) || 0;
  return sgst + cgst;
};

export const getLineDiscountBase = (item) => {
  const quantity = Number(item.quantity) || 0;
  const unitPrice = Number(item.unitPrice) || 0;
  return quantity * unitPrice;
};

export const getLineDiscountPercent = (item) => {
  const base = getLineDiscountBase(item);
  const discount = Number(item.discount) || 0;
  if (!base || discount <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, (discount / base) * 100));
};

export const getLineTotal = (item, sku) => {
  const quantity = Number(item.quantity) || 0;
  const unitPrice = Number(item.unitPrice) || 0;
  const discount = Number(item.discount) || 0;
  const gstRate = getSkuGstRate(sku);
  const base = Math.max(0, quantity * unitPrice - discount);
  return base + base * (gstRate / 100);
};

export const getOrderTotal = (items, skuMap) =>
  items.reduce(
    (sum, item) => sum + getLineTotal(item, skuMap?.get?.(String(item.skuId)) ?? null),
    0
  );

export const getOrderDiscountTotal = (items) =>
  items.reduce((sum, item) => sum + (Number(item.discount) || 0), 0);
