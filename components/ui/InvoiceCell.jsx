import Link from "next/link";

const PILL = "inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-widest";
const NOT_YET_ISSUED_TONE = "bg-slate-100 text-slate-700";
const NEVER_ISSUED_TONE = "bg-rose-50 text-rose-700 border border-rose-200";

function resolveState(invoiceNumber, status) {
  if (typeof invoiceNumber === "string" && invoiceNumber.trim().length > 0) return "ISSUED";
  const normalizedStatus = String(status).toUpperCase();
  if (normalizedStatus === "PENDING" || normalizedStatus === "READY_TO_SHIP") return "NOT_YET_ISSUED";
  if (normalizedStatus === "CANCELLED") return "NEVER_ISSUED";
  return "UNKNOWN";
}

export default function InvoiceCell({ invoiceNumber, status, href, className }) {
  const state = resolveState(invoiceNumber, status);

  if (state === "ISSUED") {
    const numberClassName = `font-mono font-semibold text-slate-900 ${className || ""}`.trim();
    if (href) {
      return (
        <Link href={href} className={`hover:underline ${numberClassName}`}>
          {invoiceNumber}
        </Link>
      );
    }
    return <span className={numberClassName}>{invoiceNumber}</span>;
  }

  if (state === "NOT_YET_ISSUED") {
    return <span className={`${PILL} ${NOT_YET_ISSUED_TONE}`}>Not yet issued</span>;
  }

  if (state === "NEVER_ISSUED") {
    return <span className={`${PILL} ${NEVER_ISSUED_TONE}`}>Never issued</span>;
  }

  return <span className="text-slate-400">—</span>;
}
