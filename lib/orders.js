export const createEmptyOrderItem = () => ({
  brandId: "",
  skuId: "",
  quantity: "",
  unitPrice: "",
  discount: "0",
  discountPercent: "0",
  discountLastEdited: "amount"
});

export const getSkuGstRate = (sku) => {
  const sgst = Number(sku?.sgst_percent) || 0;
  const cgst = Number(sku?.cgst_percent) || 0;
  const igst = Number(sku?.igst_percent) || 0;
  return igst || sgst + cgst;
};

export const getLineDiscountBase = (item) => {
  const quantity = Number(item.quantity) || 0;
  const unitPrice = Number(item.unitPrice) || 0;
  return quantity * unitPrice;
};

export const getLineDiscountPercent = (item) => {
  const discount = Number(item.discount) || 0;
  const listPrice = (Number(item.unitPrice) || 0) + discount;
  if (!listPrice || discount <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, (discount / listPrice) * 100));
};

export const getLineTaxableValue = (item, sku) => {
  const quantity = Number(item.quantity) || 0;
  const listPrice = Number(sku?.mrp ?? sku?.rate) || Number(item.unitPrice) || 0;
  const discount = Number(item.discount) || 0;
  return Math.max(0, quantity * listPrice - quantity * discount);
};

export const getLineTaxAmount = (item, sku) => {
  const taxableValue = getLineTaxableValue(item, sku);
  const gstRate = getSkuGstRate(sku);
  return taxableValue * (gstRate / 100);
};

export const getLineTotal = (item, sku) => {
  const taxableValue = getLineTaxableValue(item, sku);
  return taxableValue + getLineTaxAmount(item, sku);
};

export const getOrderTotal = (items, skuMap) =>
  items.reduce(
    (sum, item) => sum + getLineTotal(item, skuMap?.get?.(String(item.skuId)) ?? null),
    0
  );

export const getOrderDiscountTotal = (items) =>
  items.reduce((sum, item) => sum + (Number(item.discount) || 0) * (Number(item.quantity) || 0), 0);
