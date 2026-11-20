import { formatCount, formatCurrency } from "@/lib/format";

// How an order line reads, on every order screen. A line of whole packs reads as packs × the
// pack's price after discount, which is the line total exactly (finance.pack_line on the server).
// Anything else reads in pieces at the piece rate, with its discount.

export function itemName(item) {
  return item.sku_name || item.sku_code || `SKU ${item.sku_id}`;
}

export function lineQuantity(item) {
  return item.pack_count ? `${formatCount(item.pack_count)} ${item.pack_type}` : formatCount(item.quantity);
}

export function lineRate(item) {
  return formatCurrency(item.pack_count ? item.pack_price : item.unit_price);
}

/** The line's discount as text, or null: a pack line has it inside its pack price already. */
export function lineDiscount(item) {
  return !item.pack_count && Number(item.discount_amount) ? formatCurrency(item.discount_amount) : null;
}
