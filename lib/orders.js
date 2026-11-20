// Pricing for the order form's live preview (components/orders/OrderForm). The server reprices
// every order on create; these only keep the form's running bill honest while it is keyed in.

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

const getLineTaxableValue = (item, sku) => {
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
