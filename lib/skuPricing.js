// SKU pricing math, shared by the Quick Create form and the inline catalog row editor.
//
// It lives here rather than in either component because the two must agree exactly: MRP,
// discount and the three GST pairs are mutually derived, and a second copy of these rules
// would drift the first time one side changed. `__lastEdited` records which half of each
// pair the user typed last, so the other half is the one recomputed.

const LAST_EDITED_DEFAULT = { discount: null, sgst: null, cgst: null, igst: null };

export const emptySku = () => ({
  name: "",
  code: "",
  brand_id: "",
  hsn_code: "",
  distributor_landing_price: "",
  mrp: "",
  discount_amount: "",
  discount_percent: "",
  rate: "",
  sgst_percent: "",
  sgst_amount: "",
  cgst_percent: "",
  cgst_amount: "",
  igst_percent: "",
  igst_amount: "",
  amount: "",
  weight: "",
  length_cm: "",
  width_cm: "",
  height_cm: "",
  __lastEdited: { ...LAST_EDITED_DEFAULT }
});

export const toNumber = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatNumber = (value) => {
  if (value === null) return "";
  return (Math.round((value + Number.EPSILON) * 1000) / 1000).toFixed(3);
};

const getMrpBase = (sku) => {
  const mrp = toNumber(sku.mrp);
  if (mrp === null) return null;
  return mrp;
};

const getNextLastEdited = (current, field) => {
  const next = { ...(current || LAST_EDITED_DEFAULT) };
  switch (field) {
    case "discount_percent":
      next.discount = "percent";
      break;
    case "discount_amount":
      next.discount = "amount";
      break;
    case "sgst_percent":
      next.sgst = "percent";
      break;
    case "sgst_amount":
      next.sgst = "amount";
      break;
    case "cgst_percent":
      next.cgst = "percent";
      break;
    case "cgst_amount":
      next.cgst = "amount";
      break;
    case "igst_percent":
      next.igst = "percent";
      break;
    case "igst_amount":
      next.igst = "amount";
      break;
    default:
      break;
  }
  return next;
};

const syncDiscountFields = (nextSku, changedField) => {
  if (
    changedField !== "discount_percent" &&
    changedField !== "discount_amount" &&
    changedField !== "mrp"
  ) {
    return;
  }
  const base = getMrpBase(nextSku);
  const percent = toNumber(nextSku.discount_percent);
  const amount = toNumber(nextSku.discount_amount);
  if (changedField === "discount_percent") {
    if (percent === null) {
      nextSku.discount_amount = "";
      return;
    }
    nextSku.discount_amount = base === null ? "" : formatNumber((base * percent) / 100);
    return;
  }
  if (changedField === "discount_amount") {
    if (amount === null) {
      nextSku.discount_percent = "";
      return;
    }
    nextSku.discount_percent = base === null ? "" : formatNumber((amount / base) * 100);
    return;
  }
  if (base === null) {
    return;
  }
  const lastEdited = nextSku.__lastEdited?.discount;
  if (lastEdited === "amount") {
    nextSku.discount_percent = amount === null ? "" : formatNumber((amount / base) * 100);
    return;
  }
  if (lastEdited === "percent") {
    nextSku.discount_amount = percent === null ? "" : formatNumber((base * percent) / 100);
    return;
  }
  if (percent !== null) {
    nextSku.discount_amount = formatNumber((base * percent) / 100);
    return;
  }
  if (amount !== null) {
    nextSku.discount_percent = formatNumber((amount / base) * 100);
  }
};

const syncTaxAndRate = (nextSku, changedField) => {
  const taxPairs = [
    { key: "sgst", percent: "sgst_percent", amount: "sgst_amount" },
    { key: "cgst", percent: "cgst_percent", amount: "cgst_amount" },
    { key: "igst", percent: "igst_percent", amount: "igst_amount" }
  ];
  const changedTaxPair = taxPairs.find((pair) => pair.percent === changedField || pair.amount === changedField);
  if (changedTaxPair) {
    const percentValue = toNumber(nextSku[changedTaxPair.percent]);
    const amountValue = toNumber(nextSku[changedTaxPair.amount]);
    if (changedField === changedTaxPair.percent && percentValue === null) {
      nextSku[changedTaxPair.amount] = "";
    }
    if (changedField === changedTaxPair.amount && amountValue === null) {
      nextSku[changedTaxPair.percent] = "";
    }
  }

  const base = getMrpBase(nextSku);
  const rawDiscountAmount = nextSku.discount_amount;
  const discountAmount = toNumber(rawDiscountAmount);
  const hasDiscountInput =
    rawDiscountAmount !== "" && rawDiscountAmount !== null && rawDiscountAmount !== undefined;
  if (base === null || (hasDiscountInput && discountAmount === null)) {
    nextSku.amount = "";
    nextSku.rate = "";
    return;
  }

  const amountValue = Math.max(base - (discountAmount ?? 0), 0);
  nextSku.amount = formatNumber(amountValue);
  const lastEdited = nextSku.__lastEdited || LAST_EDITED_DEFAULT;
  let totalPercent = 0;
  let totalAmount = 0;

  const taxState = taxPairs.map((pair) => {
    const percentValue = toNumber(nextSku[pair.percent]);
    const amountValue = toNumber(nextSku[pair.amount]);
    const mode = lastEdited[pair.key];
    let usePercent = false;
    let useAmount = false;

    if (mode === "percent") {
      usePercent = percentValue !== null;
    } else if (mode === "amount") {
      useAmount = amountValue !== null;
    } else if (percentValue !== null) {
      usePercent = true;
    } else if (amountValue !== null) {
      useAmount = true;
    }

    if (usePercent) totalPercent += percentValue;
    if (useAmount) totalAmount += amountValue;

    return {
      ...pair,
      percentField: pair.percent,
      amountField: pair.amount,
      percentValue,
      amountValue,
      usePercent,
      useAmount
    };
  });

  const denominator = 1 + totalPercent / 100;
  const rawRate = denominator ? (amountValue - totalAmount) / denominator : 0;
  const rateValue = Number.isFinite(rawRate) ? Math.max(rawRate, 0) : 0;
  nextSku.rate = formatNumber(rateValue);

  taxState.forEach((tax) => {
    if (tax.usePercent) {
      nextSku[tax.amountField] =
        tax.percentValue === null ? "" : formatNumber((rateValue * tax.percentValue) / 100);
      return;
    }
    if (tax.useAmount) {
      nextSku[tax.percentField] =
        tax.amountValue === null ? "" : rateValue ? formatNumber((tax.amountValue / rateValue) * 100) : "";
      return;
    }
    if (tax.percentValue === null) {
      nextSku[tax.percentField] = "";
    }
    if (tax.amountValue === null) {
      nextSku[tax.amountField] = "";
    }
  });
};


// Single entry point: returns the next SKU form state after one field edit, with every
// derived field brought back in step.
export function applySkuFieldChange(sku, field, value) {
  const nextSku = { ...sku, [field]: value, __lastEdited: getNextLastEdited(sku.__lastEdited, field) };
  syncDiscountFields(nextSku, field);
  syncTaxAndRate(nextSku, field);
  return nextSku;
}
