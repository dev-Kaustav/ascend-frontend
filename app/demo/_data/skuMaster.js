// Deterministic SKU Master fixture — mirrors the real `SKU Master` sheet schema.
export const SKU_MASTER = [
  { SKU_CODE: 'CRAX_RING_20', SKU_NAME: 'Crax Rings 20g', BRAND: 'Crax', CATEGORY: 'Namkeen', UNIT: 'carton', MRP: 5, RETAILER_PRICE: 720, GST_PERCENT: 12, RETAILER_PRICE_INCLUDES_GST: true, ACTIVE: true },
  { SKU_CODE: 'CRAX_CURLS_30', SKU_NAME: 'Crax Curls 30g', BRAND: 'Crax', CATEGORY: 'Namkeen', UNIT: 'carton', MRP: 10, RETAILER_PRICE: 640, GST_PERCENT: 12, RETAILER_PRICE_INCLUDES_GST: true, ACTIVE: true },
  { SKU_CODE: 'JAB_CHANA_200', SKU_NAME: 'Jabsons Roasted Chana 200g', BRAND: 'Jabsons', CATEGORY: 'Dry Fruits', UNIT: 'carton', MRP: 70, RETAILER_PRICE: 770, GST_PERCENT: 5, RETAILER_PRICE_INCLUDES_GST: true, ACTIVE: true },
  { SKU_CODE: 'JAB_PEANUT_180', SKU_NAME: 'Jabsons Masala Peanut 180g', BRAND: 'Jabsons', CATEGORY: 'Dry Fruits', UNIT: 'carton', MRP: 60, RETAILER_PRICE: 690, GST_PERCENT: 5, RETAILER_PRICE_INCLUDES_GST: true, ACTIVE: true },
  { SKU_CODE: 'CRAX_NATKHAT_25', SKU_NAME: 'Crax Natkhat 25g', BRAND: 'Crax', CATEGORY: 'Namkeen', UNIT: 'carton', MRP: 5, RETAILER_PRICE: 540, GST_PERCENT: 12, RETAILER_PRICE_INCLUDES_GST: true, ACTIVE: true },
  { SKU_CODE: 'CRAX_FRITZ_45', SKU_NAME: 'Crax Fritz 45g', BRAND: 'Crax', CATEGORY: 'Namkeen', UNIT: 'carton', MRP: 10, RETAILER_PRICE: 600, GST_PERCENT: 12, RETAILER_PRICE_INCLUDES_GST: true, ACTIVE: true },
  { SKU_CODE: 'JAB_CASHEW_100', SKU_NAME: 'Jabsons Cashew 100g', BRAND: 'Jabsons', CATEGORY: 'Dry Fruits', UNIT: 'carton', MRP: 120, RETAILER_PRICE: 1180, GST_PERCENT: 5, RETAILER_PRICE_INCLUDES_GST: true, ACTIVE: true },
  { SKU_CODE: 'CRAX_OLD_15', SKU_NAME: 'Crax Classic 15g (discontinued)', BRAND: 'Crax', CATEGORY: 'Namkeen', UNIT: 'carton', MRP: 5, RETAILER_PRICE: 480, GST_PERCENT: 12, RETAILER_PRICE_INCLUDES_GST: true, ACTIVE: false },
];

export const SKU_BY_CODE = Object.fromEntries(SKU_MASTER.map((s) => [s.SKU_CODE, s]));
