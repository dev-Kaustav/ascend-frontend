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
