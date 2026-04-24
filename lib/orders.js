export const createEmptyOrderItem = () => ({
  brandId: "",
  skuId: "",
  quantity: "",
  unitPrice: "",
  discount: "0",
  discountPercent: "0",
  discountLastEdited: "amount"
});

export const roundToTwo = (value) => {
  const number = Number(value) || 0;
  return Math.round((number + Number.EPSILON) * 100) / 100;
};

export const getSkuGstRate = (sku) => {
  const sgst = Number(sku?.sgst_percent) || 0;
  const cgst = Number(sku?.cgst_percent) || 0;
  const igst = Number(sku?.igst_percent) || 0;
  return igst || sgst + cgst;
};

export const getLineDiscountBase = (item) => {
  const quantity = Number(item.quantity) || 0;
  const unitPrice = Number(item.unitPrice) || 0;
  return roundToTwo(quantity * unitPrice);
};

export const getLineDiscountPercent = (item) => {
  const discount = Number(item.discount) || 0;
  const listPrice = (Number(item.unitPrice) || 0) + discount;
  if (!listPrice || discount <= 0) {
    return 0;
  }
  return roundToTwo(Math.min(100, Math.max(0, (discount / listPrice) * 100)));
};

export const getLineTaxableValue = (item, sku) => {
  const quantity = Number(item.quantity) || 0;
  const listPrice = Number(sku?.mrp ?? sku?.rate) || Number(item.unitPrice) || 0;
  const discount = Number(item.discount) || 0;
  return roundToTwo(Math.max(0, quantity * listPrice - quantity * discount));
};

export const getLineTaxAmount = (item, sku) => {
  const taxableValue = getLineTaxableValue(item, sku);
  const gstRate = getSkuGstRate(sku);
  return roundToTwo(taxableValue * (gstRate / 100));
};

export const getLineTotal = (item, sku) => {
  return getLineTaxableValue(item, sku);
};

export const getOrderTotal = (items, skuMap) =>
  roundToTwo(
    items.reduce(
      (sum, item) => sum + getLineTotal(item, skuMap?.get?.(String(item.skuId)) ?? null),
      0
    )
  );

export const getOrderDiscountTotal = (items) =>
  roundToTwo(
    items.reduce((sum, item) => sum + (Number(item.discount) || 0) * (Number(item.quantity) || 0), 0)
  );
