import dayjs from "dayjs";

export function formatCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

export function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

// Short rupee amounts for chart axes, in the Indian way: ₹900, ₹25k, ₹1.5L, ₹2Cr.
export function formatCompactCurrency(value) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  const trim = (x) => String(Number(x.toFixed(1)));
  if (abs >= 1e7) return `₹${trim(n / 1e7)}Cr`;
  if (abs >= 1e5) return `₹${trim(n / 1e5)}L`;
  if (abs >= 1e3) return `₹${trim(n / 1e3)}k`;
  return `₹${Math.round(n)}`;
}

// Quantities and counts: whole numbers print whole ("36", not "36.00"); a fractional quantity
// keeps up to two places.
export function formatCount(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
}

export function formatDate(value) {
  if (!value) return "—";
  return dayjs(value).format("DD MMM YYYY");
}

export function formatDateTime(value) {
  if (!value) return "—";
  return dayjs(value).format("DD MMM YYYY, HH:mm");
}

export function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${formatNumber(value)}%`;
}

export function toTitleCase(value) {
  if (!value) return "—";
  return String(value)
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
