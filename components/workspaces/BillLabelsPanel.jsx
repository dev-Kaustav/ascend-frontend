"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, apiEndpoints } from "@/lib/api";

const HISTORY_WINDOW_DAYS = 7;
const LABEL_PREVIEW_WIDTH = 372;
const LABEL_PREVIEW_HEIGHT = 248;
const LABEL_CANVAS_WIDTH = 900;
const LABEL_CANVAS_HEIGHT = 600;
const OCR_CONCURRENCY = Math.min(4, Math.max(2, (typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 2));
const SUPPORT_MOBILE_NO = "+91 7891661335";

function normalizeText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function normalizeGstNo(value) {
  return normalizeText(value).replace(/[^0-9A-Z]/gi, "").toUpperCase();
}

function normalizePageSearchText(value) {
  return normalizeText(value).toLowerCase();
}

function isLikelyBillStartPage(rawText) {
  const text = normalizePageSearchText(rawText);
  if (!text) return false;

  const hasInvoiceHeading = text.includes("tax invoice");
  const hasPageOneMarker = /\bpage\s*1\s*of\s*\d+\b/i.test(text);
  const hasBillIdentity = /\bbill\s*no\b/i.test(text) || /\binvoice\s*date\b/i.test(text) || /\border\s*id\b/i.test(text);

  return (hasInvoiceHeading && hasBillIdentity) || (hasPageOneMarker && hasBillIdentity);
}

function extractField(text, ...patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) return match[1].trim();
  }
  return "";
}

function cleanOutletCandidate(value) {
  return normalizeText(
    (value || "")
      .replace(/\bGST(?:IN)?\b.*$/i, "")
      .replace(/\bBeat(?:\s*Name)?\b.*$/i, "")
      .replace(/^[^A-Za-z0-9(]+/, "")
  );
}

function parseBillText(raw) {
  const text = raw.replace(/\r\n/g, "\n");
  const billNo = normalizeText(
    extractField(
      text,
      /Bill\s*No\.?\s*[:\-]?\s*([A-Z0-9\/\-]+)/i,
      /Invoice\s*No\.?\s*[:\-]?\s*([A-Z0-9\/\-]+)/i
    )
  );
  const invoiceDate = normalizeText(
    extractField(
      text,
      /Invoice\s*Date\s*[:\-]?\s*([0-9\-\/]+)/i,
      /Date\s*[:\-]?\s*([0-9\-\/]+)/i
    )
  );
  const salesmanName = normalizeText(
    extractField(
      text,
      /Salesman\s*Name\s*[:\-]?\s*([^\n]+)/i,
      /Salesman\s*[:\-]?\s*([^\n]+)/i
    )
  );
  const beat = normalizeText(
    extractField(
      text,
      /Beat(?:\s*Name)?\s*[:\-]?\s*([^\n]+)/i,
      /Route\s*[:\-]?\s*([^\n]+)/i
    )
  );
  const gstNo = normalizeGstNo(
    extractField(
      text,
      /GST(?:IN)?\s*(?:No\.?)?\s*[:\-]?\s*([0-9A-Z\s]{15,20})/i,
      /GSTIN\s*[:\-]?\s*([0-9A-Z\s]{15,20})/i
    )
  );
  const outletName = cleanOutletCandidate(
    extractField(
      text,
      /^To\s*:?\s*(.+)$/im,
      /^M\/s\.?\s*(.+)$/im,
      /^Customer\s*:?\s*(.+)$/im,
      /^Retailer\s*:?\s*(.+)$/im
    )
  );

  return {
    billNo,
    invoiceDate,
    salesmanName,
    beat,
    gstNo,
    outletName,
  };
}

function buildQrPayload(bill) {
  return [
    bill.billNo && `Bill: ${bill.billNo}`,
    bill.outletName && `Outlet: ${bill.outletName}`,
    bill.gstNo && `GSTIN: ${bill.gstNo}`,
    bill.beat && `Beat: ${bill.beat}`,
    bill.salesmanName && `Salesman: ${bill.salesmanName}`,
    bill.invoiceDate && `Date: ${bill.invoiceDate}`,
  ].filter(Boolean).join("\n");
}

async function generateQR(text) {
  const QRCode = (await import("qrcode")).default;
  return QRCode.toDataURL(text || "Ascend Foods", {
    width: 180,
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
  });
}

async function ensureQrDataUrl(bill) {
  if (bill.qrDataUrl) return bill;
  return {
    ...bill,
    qrDataUrl: await generateQR(buildQrPayload(bill)),
  };
}

function wrapTextByMeasure(text, measure, maxWidth, maxLines = 3) {
  const words = normalizeText(text).split(" ").filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);

  if (lines.length <= maxLines) return lines;

  const visible = lines.slice(0, maxLines);
  visible[maxLines - 1] = `${visible[maxLines - 1].replace(/\s+$/, "")}…`;
  return visible;
}

function getFooterCode(billNo) {
  return (billNo || "XXXX")
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase()
    .padEnd(16, "0")
    .slice(0, 16);
}

function getPreviewTextLines(bill) {
  const measure = (fontSize, ratio = 0.56) => (value) => value.length * fontSize * ratio;
  const outletLines = wrapTextByMeasure(bill.outletName || "Outlet Name", measure(42, 0.53), 560, 3);
  const billNoLines = wrapTextByMeasure(bill.billNo || "—", measure(26, 0.54), 560, 1);
  const beatLines = wrapTextByMeasure(bill.beat || "—", measure(26, 0.54), 560, 2);
  const salesmanLines = wrapTextByMeasure(bill.salesmanName || "—", measure(26, 0.54), 240, 1);
  const dateLines = wrapTextByMeasure(bill.invoiceDate || "—", measure(26, 0.54), 180, 1);

  return { outletLines, billNoLines, beatLines, salesmanLines, dateLines };
}

async function createLabelsPdf(rawBills) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdfDoc = await PDFDocument.create();
  const textFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const monoFont = await pdfDoc.embedFont(StandardFonts.CourierBold);
  const labels = await Promise.all(rawBills.map((bill) => ensureQrDataUrl(bill)));
  const scale = 216 / LABEL_CANVAS_WIDTH;
  const pageWidth = 216;
  const pageHeight = 144;
  const px = (value) => value * scale;
  const yFromTop = (top, fontSize) => pageHeight - px(top) - fontSize;

  function drawWrapped(page, font, text, x, top, maxWidth, fontSize, lineHeight, maxLines = 3) {
    const lines = wrapTextByMeasure(text, (value) => font.widthOfTextAtSize(value, fontSize), maxWidth, maxLines);
    lines.forEach((line, index) => {
      page.drawText(line, {
        x,
        y: yFromTop(top + index * lineHeight, fontSize),
        size: fontSize,
        font,
        color: rgb(0.07, 0.07, 0.07),
      });
    });
    return lines.length;
  }

  for (const [index, bill] of labels.entries()) {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    const qrImage = bill.qrDataUrl ? await pdfDoc.embedPng(bill.qrDataUrl) : null;

    page.drawRectangle({ x: px(4), y: px(4), width: pageWidth - px(8), height: pageHeight - px(8), borderWidth: px(8), borderColor: rgb(0.07, 0.07, 0.07) });
    page.drawRectangle({ x: 0, y: pageHeight - px(90), width: pageWidth, height: px(90), color: rgb(0.07, 0.07, 0.07) });
    page.drawText("ASCEND FOODS", { x: px(40), y: yFromTop(36, px(28)), size: px(28), font: boldFont, color: rgb(1, 1, 1) });
    page.drawText(`Mob No. ${SUPPORT_MOBILE_NO}`, {
      x: pageWidth - px(34) - textFont.widthOfTextAtSize(`Mob No. ${SUPPORT_MOBILE_NO}`, px(16)),
      y: yFromTop(40, px(16)),
      size: px(16),
      font: textFont,
      color: rgb(1, 1, 1),
    });

    page.drawLine({ start: { x: px(670), y: pageHeight - px(90) }, end: { x: px(670), y: px(90) }, thickness: px(3), color: rgb(0.45, 0.45, 0.45), dashArray: [px(10), px(10)] });

    page.drawText("DELIVER TO", { x: px(42), y: yFromTop(124, px(18)), size: px(18), font: boldFont, color: rgb(0.38, 0.38, 0.38) });
    const outletLines = drawWrapped(page, boldFont, bill.outletName || "Outlet Name", px(42), 162, px(560), px(42), px(46), 3);
    const metaStartY = 162 + outletLines * 46 + 24;

    page.drawText("BILL NO.", { x: px(42), y: yFromTop(metaStartY, px(18)), size: px(18), font: boldFont, color: rgb(0.38, 0.38, 0.38) });
    drawWrapped(page, boldFont, bill.billNo || "—", px(42), metaStartY + 34, px(560), px(26), px(30), 1);

    page.drawText("BEAT", { x: px(42), y: yFromTop(metaStartY + 86, px(18)), size: px(18), font: boldFont, color: rgb(0.38, 0.38, 0.38) });
    drawWrapped(page, boldFont, bill.beat || "—", px(42), metaStartY + 120, px(560), px(26), px(30), 2);

    page.drawLine({ start: { x: px(42), y: pageHeight - px(448) }, end: { x: px(646), y: pageHeight - px(448) }, thickness: px(2), color: rgb(0.67, 0.67, 0.67), dashArray: [px(8), px(8)] });
    page.drawText("SALESMAN", { x: px(42), y: yFromTop(474, px(16)), size: px(16), font: boldFont, color: rgb(0.38, 0.38, 0.38) });
    page.drawText("DATE", { x: px(330), y: yFromTop(474, px(16)), size: px(16), font: boldFont, color: rgb(0.38, 0.38, 0.38) });
    drawWrapped(page, boldFont, bill.salesmanName || "—", px(42), 510, px(240), px(26), px(28), 1);
    drawWrapped(page, boldFont, bill.invoiceDate || "—", px(330), 510, px(180), px(26), px(28), 1);

    if (qrImage) {
      page.drawRectangle({ x: px(712), y: pageHeight - px(328), width: px(156), height: px(156), borderWidth: px(2), borderColor: rgb(0.07, 0.07, 0.07) });
      page.drawImage(qrImage, { x: px(720), y: pageHeight - px(320), width: px(140), height: px(140) });
    } else {
      page.drawRectangle({ x: px(720), y: pageHeight - px(320), width: px(140), height: px(140), borderWidth: px(2), borderColor: rgb(0.3, 0.3, 0.3) });
    }

    page.drawText(bill.billNo || "—", { x: px(790) - monoFont.widthOfTextAtSize(bill.billNo || "—", px(20)) / 2, y: yFromTop(344, px(20)), size: px(20), font: monoFont, color: rgb(0.07, 0.07, 0.07) });
    page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: px(60), color: rgb(0.94, 0.94, 0.94) });
    page.drawLine({ start: { x: 0, y: px(60) }, end: { x: pageWidth, y: px(60) }, thickness: px(4), color: rgb(0.07, 0.07, 0.07) });
    page.drawText(getFooterCode(bill.billNo), { x: px(40), y: yFromTop(560, px(20)), size: px(20), font: monoFont, color: rgb(0.07, 0.07, 0.07) });
    page.drawText(String(index + 1), { x: pageWidth - px(32), y: yFromTop(560, px(18)), size: px(18), font: textFont, color: rgb(0.42, 0.42, 0.42) });
  }

  return pdfDoc.save();
}

async function pdfToBillStartImages(file, scale = 3.2, onProgress) {
  const pdfjsLib = await import("pdfjs-dist/build/pdf.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const startPages = [];

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");

    if (isLikelyBillStartPage(pageText)) {
      startPages.push(i);
    }

    onProgress?.({
      phase: "scan",
      current: i,
      total: pdf.numPages,
      selected: startPages.length,
    });
  }

  const pageNumbers = startPages.length ? startPages : [1];
  const pages = [];

  for (const [index, pageNum] of pageNumbers.entries()) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const previewUrl = URL.createObjectURL(blob);
    pages.push({ blob, previewUrl, pageNum });
    onProgress?.({
      phase: "render",
      current: index + 1,
      total: pageNumbers.length,
      selected: pageNumbers.length,
      sourcePage: pageNum,
      usedFallback: !startPages.length,
    });
  }

  return pages;
}

async function runOCR(fileOrBlob) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  const url = URL.createObjectURL(fileOrBlob);
  const { data } = await worker.recognize(url);
  await worker.terminate();
  URL.revokeObjectURL(url);
  return data.text;
}

function mapApiLabel(record) {
  return {
    id: record.id,
    savedId: record.id,
    status: "saved",
    billNo: record.bill_no || "",
    invoiceDate: record.invoice_date || "",
    salesmanName: record.salesman_name || "",
    beat: record.beat || "",
    gstNo: record.gst_no || "",
    outletName: record.outlet_name || "",
    fileName: record.original_filename || "",
    createdAt: record.created_at || null,
    qrDataUrl: null,
  };
}

async function processWithConcurrency(items, worker, limit = OCR_CONCURRENCY) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const next = queue.shift();
      if (!next) return;
      await worker(next);
    }
  });
  await Promise.all(runners);
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4l3-3-3-3v4a8 8 0 0 0-8 8h4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9V2h12v7" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SortIcon({ active = false, direction = "asc" }) {
  return (
    <svg viewBox="0 0 16 16" className={`h-3.5 w-3.5 ${active ? "text-slate-700" : "text-slate-300"}`} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 3 8 6 11 3" className={active && direction === "desc" ? "opacity-30" : ""} />
      <path d="M11 13 8 10 5 13" className={active && direction === "asc" ? "opacity-30" : ""} />
    </svg>
  );
}

function getStatusMeta(status) {
  switch (status) {
    case "queued":
      return {
        label: "Queued",
        detail: "Waiting to start OCR",
        tone: "bg-slate-100 text-slate-600",
        step: 0,
      };
    case "processing":
      return {
        label: "Extracting",
        detail: "OCR and label prep running",
        tone: "bg-slate-100 text-slate-700",
        step: 1,
      };
    case "saving":
      return {
        label: "Saving",
        detail: "Automatically saving to history",
        tone: "bg-slate-100 text-slate-700",
        step: 3,
      };
    case "done":
      return {
        label: "Ready",
        detail: "Label is ready and will sync automatically",
        tone: "bg-amber-100 text-amber-800",
        step: 2,
      };
    case "saved":
      return {
        label: "Saved",
        detail: "Available in 7-day history",
        tone: "bg-slate-900 text-white",
        step: 3,
      };
    case "save_error":
      return {
        label: "Save Failed",
        detail: "Metadata is ready. Retry save.",
        tone: "bg-red-100 text-red-700",
        step: 2,
      };
    default:
      return {
        label: "Needs Review",
        detail: "Fill the fields and confirm the label",
        tone: "bg-red-100 text-red-700",
        step: 2,
      };
  }
}

function StepRail({ step }) {
  const steps = ["Upload", "Extract", "Review", "Saved"];

  return (
    <div className="flex items-center gap-2">
      {steps.map((label, index) => (
        <div key={label} className="flex min-w-0 flex-1 items-center gap-2">
          <div className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-slate-900" : "bg-slate-200"}`} />
          <span className={`hidden text-[10px] font-semibold uppercase tracking-[0.2em] lg:inline ${index <= step ? "text-slate-700" : "text-slate-400"}`}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

function BatchMetric({ label, value, tone = "text-slate-900" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${tone}`}>{value}</div>
    </div>
  );
}

function EditableField({ label, value, onChange }) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</span>
      {editing ? (
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(event) => {
            if (event.key === "Enter") setEditing(false);
          }}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-slate-500"
        />
      ) : (
        <div className="group flex items-center gap-1">
          <span className="text-sm font-medium leading-snug text-slate-800">{value || <span className="italic text-slate-400">—</span>}</span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-slate-600"
          >
            <EditIcon />
          </button>
        </div>
      )}
    </div>
  );
}

function LabelCard({ bill, index = 0, width = LABEL_PREVIEW_WIDTH }) {
  const { outletLines, billNoLines, beatLines, salesmanLines, dateLines } = getPreviewTextLines(bill);
  const metaStartY = 162 + outletLines.length * 46 + 24;

  return (
    <div
      className="label-card overflow-hidden rounded-[14px] border-[3px] border-black bg-white text-black shadow-sm"
      style={{
        width,
        maxWidth: "100%",
        aspectRatio: "3 / 2",
      }}
    >
      <svg
        viewBox={`0 0 ${LABEL_CANVAS_WIDTH} ${LABEL_CANVAS_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full bg-white"
        role="img"
        aria-label={`Label preview for ${bill.billNo || "unsaved bill"}`}
      >
        <rect x="4" y="4" width={LABEL_CANVAS_WIDTH - 8} height={LABEL_CANVAS_HEIGHT - 8} fill="#ffffff" stroke="#111111" strokeWidth="8" />
        <rect x="0" y="0" width={LABEL_CANVAS_WIDTH} height="90" fill="#111111" />
        <text x="40" y="58" fill="#ffffff" fontSize="28" fontWeight="700" fontFamily="'Helvetica Neue', Arial, sans-serif" letterSpacing="1.6">
          ASCEND FOODS
        </text>
        <text x={LABEL_CANVAS_WIDTH - 34} y="54" fill="#ffffff" fontSize="16" fontFamily="'Helvetica Neue', Arial, sans-serif" textAnchor="end">
          Mob No. {SUPPORT_MOBILE_NO}
        </text>

        <line x1="670" y1="90" x2="670" y2="510" stroke="#666666" strokeWidth="3" strokeDasharray="10 10" />

        <text x="42" y="142" fill="#666666" fontSize="18" fontWeight="700" fontFamily="'Helvetica Neue', Arial, sans-serif" letterSpacing="1.4">
          DELIVER TO
        </text>
        {outletLines.map((line, lineIndex) => (
          <text key={`outlet-${lineIndex}`} x="42" y={190 + lineIndex * 46} fill="#111111" fontSize="42" fontWeight="700" fontFamily="'Helvetica Neue', Arial, sans-serif">
            {line}
          </text>
        ))}

        <text x="42" y={metaStartY} fill="#666666" fontSize="18" fontWeight="700" fontFamily="'Helvetica Neue', Arial, sans-serif" letterSpacing="1.4">
          BILL NO.
        </text>
        {billNoLines.map((line, lineIndex) => (
          <text key={`bill-no-${lineIndex}`} x="42" y={metaStartY + 34 + lineIndex * 30} fill="#111111" fontSize="26" fontWeight="700" fontFamily="'Helvetica Neue', Arial, sans-serif">
            {line}
          </text>
        ))}

        <text x="42" y={metaStartY + 86} fill="#666666" fontSize="18" fontWeight="700" fontFamily="'Helvetica Neue', Arial, sans-serif" letterSpacing="1.4">
          BEAT
        </text>
        {beatLines.map((line, lineIndex) => (
          <text key={`beat-${lineIndex}`} x="42" y={metaStartY + 120 + lineIndex * 30} fill="#111111" fontSize="26" fontWeight="700" fontFamily="'Helvetica Neue', Arial, sans-serif">
            {line}
          </text>
        ))}

        <line x1="42" y1="448" x2="646" y2="448" stroke="#aaaaaa" strokeWidth="2" strokeDasharray="8 8" />

        <text x="42" y="490" fill="#666666" fontSize="16" fontWeight="700" fontFamily="'Helvetica Neue', Arial, sans-serif" letterSpacing="1.2">
          SALESMAN
        </text>
        <text x="330" y="490" fill="#666666" fontSize="16" fontWeight="700" fontFamily="'Helvetica Neue', Arial, sans-serif" letterSpacing="1.2">
          DATE
        </text>
        {salesmanLines.map((line, lineIndex) => (
          <text key={`salesman-${lineIndex}`} x="42" y={524 + lineIndex * 28} fill="#111111" fontSize="26" fontWeight="700" fontFamily="'Helvetica Neue', Arial, sans-serif">
            {line}
          </text>
        ))}
        {dateLines.map((line, lineIndex) => (
          <text key={`date-${lineIndex}`} x="330" y={524 + lineIndex * 28} fill="#111111" fontSize="26" fontWeight="700" fontFamily="'Helvetica Neue', Arial, sans-serif">
            {line}
          </text>
        ))}

        <rect x="712" y="172" width="156" height="156" fill="#ffffff" stroke="#111111" strokeWidth="2" />
        {bill.qrDataUrl ? (
          <image href={bill.qrDataUrl} x="720" y="180" width="140" height="140" preserveAspectRatio="xMidYMid meet" />
        ) : (
          <text x="790" y="258" fill="#666666" fontSize="18" fontWeight="700" textAnchor="middle" fontFamily="'Helvetica Neue', Arial, sans-serif">
            QR
          </text>
        )}
        <text x="790" y="360" fill="#111111" fontSize="20" fontWeight="700" fontFamily="'Courier New', monospace" textAnchor="middle">
          {bill.billNo || "—"}
        </text>

        <rect x="0" y="540" width={LABEL_CANVAS_WIDTH} height="60" fill="#efefef" />
        <line x1="0" y1="540" x2={LABEL_CANVAS_WIDTH} y2="540" stroke="#111111" strokeWidth="4" />
        <text x="40" y="578" fill="#111111" fontSize="20" fontWeight="700" fontFamily="'Courier New', monospace" letterSpacing="1.8">
          {getFooterCode(bill.billNo)}
        </text>
        <text x="868" y="578" fill="#666666" fontSize="18" fontFamily="'Helvetica Neue', Arial, sans-serif" textAnchor="end">
          {index + 1}
        </text>
      </svg>
    </div>
  );
}

function Modal({ title, children, onClose, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div className={`w-full rounded-2xl bg-white shadow-2xl ${wide ? "max-w-5xl" : "max-w-2xl"}`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
            <CloseIcon />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function BillLabelsPanel() {
  const [tab, setTab] = useState("upload");
  const [bills, setBills] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const [historySort, setHistorySort] = useState({ key: "created_at", direction: "desc" });
  const [expandedLabelPreview, setExpandedLabelPreview] = useState(null);
  const [printBills, setPrintBills] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const fileInputRef = useRef(null);
  const uploadProgressTimeoutRef = useRef(null);
  const persistBillTimeoutsRef = useRef({});

  const PAGE_SIZE = 20;
  const sortableHistoryColumns = [
    { key: "bill_no", label: "Bill No." },
    { key: "outlet_name", label: "Outlet" },
    { key: "gst_no", label: "GSTIN" },
    { key: "beat", label: "Beat" },
    { key: "invoice_date", label: "Date" },
    { key: "original_filename", label: "Source" },
  ];

  useEffect(() => {
    if (tab === "history") loadHistory(0);
  }, [tab]);

  useEffect(() => {
    const resetAfterPrint = () => setPrintBills(null);
    window.addEventListener("afterprint", resetAfterPrint);
    return () => window.removeEventListener("afterprint", resetAfterPrint);
  }, []);

  useEffect(() => () => {
    if (uploadProgressTimeoutRef.current) clearTimeout(uploadProgressTimeoutRef.current);
    Object.values(persistBillTimeoutsRef.current).forEach((timeoutId) => clearTimeout(timeoutId));
  }, []);

  const buildBillPayload = useCallback((bill) => ({
    bill_no: bill.billNo || "",
    invoice_date: bill.invoiceDate || "",
    salesman_name: bill.salesmanName || "",
    beat: bill.beat || "",
    gst_no: bill.gstNo || "",
    outlet_name: bill.outletName || "",
    original_filename: bill.fileName || "",
  }), []);

  const persistBill = useCallback(async (bill) => {
    try {
      const saved = await apiFetch(
        bill.savedId ? apiEndpoints.billLabels.update(bill.savedId) : apiEndpoints.billLabels.create,
        {
          method: bill.savedId ? "PATCH" : "POST",
          body: JSON.stringify(buildBillPayload(bill)),
        }
      );

      setBills((prev) => prev.map((item) => (
        item.id === bill.id ? {
          ...item,
          savedId: saved.id,
          status: "saved",
          createdAt: saved.created_at || item.createdAt || null,
        } : item
      )));
    } catch (error) {
      console.error("Automatic history sync failed for", bill.fileName, error);
      setBills((prev) => prev.map((item) => (
        item.id === bill.id ? { ...item, status: "save_error" } : item
      )));
    }
  }, [buildBillPayload]);

  const schedulePersistBill = useCallback((bill, delay = 500) => {
    if (persistBillTimeoutsRef.current[bill.id]) {
      clearTimeout(persistBillTimeoutsRef.current[bill.id]);
    }
    persistBillTimeoutsRef.current[bill.id] = setTimeout(() => {
      delete persistBillTimeoutsRef.current[bill.id];
      void persistBill(bill);
    }, delay);
  }, [persistBill]);

  async function loadHistory(page, sort = historySort) {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({
        skip: String(page * PAGE_SIZE),
        limit: String(PAGE_SIZE),
        sort_by: sort.key,
        sort_dir: sort.direction,
      });
      const data = await apiFetch(`${apiEndpoints.billLabels.list}?${params.toString()}`);
      setHistory((data.items || []).map(mapApiLabel));
      setHistoryTotal(data.total || 0);
      setHistoryPage(page);
    } catch (error) {
      console.error("Failed to load history", error);
    } finally {
      setHistoryLoading(false);
    }
  }

  const toggleHistorySort = useCallback((key) => {
    const next = historySort.key === key
      ? { key, direction: historySort.direction === "asc" ? "desc" : "asc" }
      : { key, direction: "asc" };
    setHistorySort(next);
    if (tab === "history") void loadHistory(0, next);
  }, [historySort, tab]);

  const processFiles = useCallback(async (files) => {
    const selectedFiles = Array.from(files);
    const toProcess = [];
    if (uploadProgressTimeoutRef.current) clearTimeout(uploadProgressTimeoutRef.current);
    setUploadProgress({
      active: true,
      title: `Preparing ${selectedFiles.length} file${selectedFiles.length > 1 ? "s" : ""}`,
      detail: "Reading uploads and identifying the first page of each invoice before OCR starts.",
      progress: 2,
    });

    for (const [fileIndex, file] of selectedFiles.entries()) {
      if (file.type === "application/pdf") {
        try {
          const pages = await pdfToBillStartImages(file, 3.2, ({ phase, current, total, selected, sourcePage, usedFallback }) => {
            const phaseProgress = phase === "scan"
              ? (current / Math.max(total, 1)) * 0.62
              : 0.62 + ((current / Math.max(total, 1)) * 0.38);
            const progress = Math.round(((fileIndex + phaseProgress) / selectedFiles.length) * 100);
            setUploadProgress({
              active: true,
              title: `Preparing ${file.name}`,
              detail: phase === "scan"
                ? `Scanning page ${current} of ${total} for invoice starts${selected ? ` · ${selected} bill${selected > 1 ? "s" : ""} found` : ""}`
                : usedFallback
                  ? `No invoice marker found. Falling back to page ${sourcePage}.`
                  : `Rendering bill start ${current} of ${total} from PDF page ${sourcePage}`,
              progress: Math.max(4, progress),
            });
          });
          for (const page of pages) {
            toProcess.push({
              id: `${Date.now()}-${Math.random()}`,
              blob: page.blob,
              fileName: `${file.name} — page ${page.pageNum}`,
              preview: page.previewUrl,
            });
          }
        } catch (error) {
          console.error("PDF parsing failed for", file.name, error);
          toProcess.push({
            id: `${Date.now()}-${Math.random()}`,
            blob: file,
            fileName: file.name,
            preview: null,
            forceError: true,
          });
        }
      } else {
        const progress = Math.round(((fileIndex + 1) / selectedFiles.length) * 100);
        setUploadProgress({
          active: true,
          title: `Preparing ${file.name}`,
          detail: "Image is ready. Adding it to the extraction queue.",
          progress: Math.max(4, progress),
        });
        toProcess.push({
          id: `${Date.now()}-${Math.random()}`,
          blob: file,
          fileName: file.name,
          preview: URL.createObjectURL(file),
        });
      }
    }

    const newEntries = toProcess.map((item) => ({
      id: item.id,
      blob: item.blob,
      fileName: item.fileName,
      preview: item.preview,
      status: item.forceError ? "error" : "queued",
      billNo: "",
      invoiceDate: "",
      salesmanName: "",
      beat: "",
      gstNo: "",
      outletName: "",
      qrDataUrl: null,
      savedId: null,
    }));

    setUploadProgress({
      active: true,
      title: `Queued ${newEntries.length} label${newEntries.length > 1 ? "s" : ""}`,
      detail: "Starting OCR and generating live previews.",
      progress: 100,
    });
    setBills((prev) => [...prev, ...newEntries]);
    uploadProgressTimeoutRef.current = setTimeout(() => setUploadProgress(null), 400);

    await processWithConcurrency(
      newEntries.filter((entry) => entry.status !== "error"),
      async (entry) => {
        setBills((prev) => prev.map((bill) => (bill.id === entry.id ? { ...bill, status: "processing" } : bill)));

        try {
          const rawText = await runOCR(entry.blob);
          const parsed = await ensureQrDataUrl({ ...entry, ...parseBillText(rawText) });
          const nextBill = { ...parsed, status: "saving" };
          setBills((prev) => prev.map((bill) => (
            bill.id === entry.id ? { ...bill, ...nextBill } : bill
          )));
          schedulePersistBill(nextBill, 80);
        } catch (error) {
          console.error("OCR failed for", entry.fileName, error);
          setBills((prev) => prev.map((bill) => (bill.id === entry.id ? { ...bill, status: "error" } : bill)));
        }
      }
    );
  }, [schedulePersistBill]);

  const onDrop = useCallback((event) => {
    event.preventDefault();
    setDragging(false);
    const files = [...event.dataTransfer.files].filter(
      (file) => file.type.startsWith("image/") || file.type === "application/pdf"
    );
    if (files.length) processFiles(files);
  }, [processFiles]);

  const onFileChange = useCallback((event) => {
    const files = [...event.target.files];
    if (files.length) processFiles(files);
    event.target.value = "";
  }, [processFiles]);

  const updateField = useCallback((id, field, value) => {
    setBills((prev) => {
      const nextBills = prev.map((bill) => (
        bill.id === id ? {
          ...bill,
          [field]: value,
          status: bill.status === "queued" || bill.status === "processing" ? bill.status : "saving",
        } : bill
      ));
      const updatedBill = nextBills.find((bill) => bill.id === id);
      if (updatedBill) {
        if (updatedBill.status !== "queued" && updatedBill.status !== "processing") {
          schedulePersistBill(updatedBill);
        }
        void ensureQrDataUrl({ ...updatedBill, qrDataUrl: null }).then((withQr) => {
          setBills((current) => current.map((bill) => (
            bill.id === id ? { ...bill, qrDataUrl: withQr.qrDataUrl } : bill
          )));
        });
      }
      return nextBills;
    });
  }, [schedulePersistBill]);

  const removeBill = (id) => {
    if (persistBillTimeoutsRef.current[id]) {
      clearTimeout(persistBillTimeoutsRef.current[id]);
      delete persistBillTimeoutsRef.current[id];
    }
    setBills((prev) => {
      const target = prev.find((bill) => bill.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((bill) => bill.id !== id);
    });
  };

  const deleteHistoryItem = async (id) => {
    try {
      await apiFetch(apiEndpoints.billLabels.delete(id), { method: "DELETE" });
      setHistory((prev) => prev.filter((item) => item.id !== id));
      setHistoryTotal((count) => Math.max(0, count - 1));
    } catch (error) {
      console.error("Delete failed", error);
    }
  };

  const openLabelPreview = async (bill) => {
    setExpandedLabelPreview(await ensureQrDataUrl(bill));
  };

  const downloadPdf = async (items, filename) => {
    const bytes = await createLabelsPdf(items);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const downloadLabelPdf = async (bill) => {
    const safeBillNo = (bill.billNo || "label").replace(/[^A-Z0-9_-]/gi, "-");
    await downloadPdf([bill], `${safeBillNo}.pdf`);
  };

  const downloadBatchPdf = async () => {
    const readyBills = doneBills.filter((bill) => bill.status !== "processing" && bill.status !== "queued");
    if (!readyBills.length) return;
    await downloadPdf(readyBills, `ascend-labels-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const triggerPrint = async (items) => {
    const resolved = await Promise.all(items.map((item) => ensureQrDataUrl(item)));
    setPrintBills(resolved);
    setTimeout(() => window.print(), 60);
  };

  const doneBills = bills.filter((bill) => bill.status === "done" || bill.status === "saving" || bill.status === "saved" || bill.status === "save_error");
  const totalBills = bills.length;
  const processingCount = bills.filter((bill) => bill.status === "processing" || bill.status === "queued").length;
  const syncingCount = bills.filter((bill) => bill.status === "saving").length;
  const savedCount = bills.filter((bill) => bill.status === "saved").length;
  const reviewCount = bills.filter((bill) => bill.status === "done" || bill.status === "save_error" || bill.status === "error").length;
  const failedCount = bills.filter((bill) => bill.status === "error" || bill.status === "save_error").length;
  const extractedCount = totalBills - processingCount;
  const extractionProgress = totalBills ? Math.round((extractedCount / totalBills) * 100) : 0;
  const batchMessage = processingCount > 0
    ? "Keep this tab open while OCR runs. Label previews update automatically as each bill finishes."
    : syncingCount > 0
      ? "Labels are being saved to history automatically as metadata settles."
      : failedCount > 0
        ? "Some labels need review. Any edits you make will sync to history automatically."
      : savedCount > 0
        ? "This batch is saved. You can reopen, print, or download labels from History for 7 days."
        : "Upload bills to start OCR and generate label previews.";

  return (
    <>
      <style>{`
        @page {
          margin: 0.12in;
        }

        @media print {
          body * {
            visibility: hidden !important;
          }

          #print-area, #print-area * {
            visibility: visible !important;
          }

          #print-area {
            display: block !important;
            position: fixed !important;
            top: 0;
            left: 0;
            width: 100vw;
            padding: 0.12in;
          }

          .label-card {
            width: 3in !important;
            min-height: 2in !important;
            height: 2in !important;
            break-inside: avoid;
            margin: 0 0 0.12in 0 !important;
            box-shadow: none !important;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="min-h-full p-6 no-print">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Bill Labels</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Bills are processed in the browser for OCR, only label metadata is saved, and labels are generated as monochrome 3 × 2 inch PDFs at runtime.
            </p>
          </div>
        </div>

        <div className="mb-6 flex w-fit gap-1 rounded-xl bg-slate-100 p-1">
          {[
            { key: "upload", label: "Upload & Generate" },
            { key: "history", label: `History (${HISTORY_WINDOW_DAYS} days)` },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                tab === item.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {item.key === "history" && <HistoryIcon />}
              {item.label}
            </button>
          ))}
        </div>

        {tab === "upload" && (
          <>
            <div
              className={`mb-6 flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-colors ${
                dragging ? "border-slate-900 bg-slate-100" : "border-slate-300 bg-white hover:border-slate-500 hover:bg-slate-50"
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf"
                className="hidden"
                onChange={onFileChange}
              />
              <div className="mb-2 text-slate-400"><UploadIcon /></div>
              <p className="text-sm font-semibold text-slate-700">Drop bill files here, or click to browse</p>
              <p className="mt-1 text-xs text-slate-400">Supports PDF, PNG, JPG. PDFs are scanned for invoice-start pages first, then OCR runs in parallel on those pages only.</p>
            </div>

            {uploadProgress?.active && (
              <div className="mb-5 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Upload Progress</div>
                    <div className="mt-1 text-lg font-bold text-slate-900">{uploadProgress.title}</div>
                    <p className="mt-1 text-sm text-slate-500">{uploadProgress.detail}</p>
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                    {uploadProgress.progress}%
                  </div>
                </div>
                <div className="mt-4 h-2 rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-slate-900 transition-all duration-300"
                    style={{ width: `${uploadProgress.progress}%` }}
                  />
                </div>
              </div>
            )}

            {bills.length > 0 && (
              <div className="mb-5 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Current Batch</div>
                    <div className="mt-1 text-xl font-bold text-slate-900">
                      {totalBills} file{totalBills !== 1 ? "s" : ""} in this run
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{batchMessage}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {doneBills.length > 0 && (
                      <button
                        type="button"
                        onClick={downloadBatchPdf}
                        className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50"
                      >
                        <DownloadIcon /> Batch PDF
                      </button>
                    )}
                    {doneBills.length > 0 && (
                      <button
                        type="button"
                        onClick={() => triggerPrint(doneBills)}
                        className="flex items-center gap-2 rounded-xl border border-black px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-slate-100"
                      >
                        <PrintIcon /> Print Ready Labels
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <BatchMetric label="Processing" value={processingCount} tone="text-slate-700" />
                  <BatchMetric label="Syncing" value={syncingCount} tone="text-slate-700" />
                  <BatchMetric label="Needs Review" value={reviewCount} tone={failedCount > 0 ? "text-red-700" : "text-amber-700"} />
                  <BatchMetric label="Saved" value={savedCount} tone="text-slate-900" />
                  <BatchMetric label="Issues" value={failedCount} tone={failedCount > 0 ? "text-red-700" : "text-slate-500"} />
                </div>

                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                    <span>Extraction Progress</span>
                    <span>{extractedCount}/{totalBills || 0}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-slate-900 transition-all duration-300"
                      style={{ width: `${extractionProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {bills.length > 0 && (
              <div className="space-y-4">
                {bills.map((bill, index) => {
                  const statusMeta = getStatusMeta(bill.status);
                  const previewLocked = bill.status === "queued" || bill.status === "processing";

                  return (
                    <div key={bill.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {bill.status === "processing" || bill.status === "queued" ? (
                                <span className="text-slate-500"><SpinnerIcon /></span>
                              ) : bill.status === "done" ? (
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><CheckIcon /></span>
                              ) : bill.status === "saved" ? (
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white"><CheckIcon /></span>
                              ) : (
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-500 text-xs font-bold">!</span>
                              )}
                              <span className="max-w-xs truncate text-sm font-medium text-slate-700">{bill.fileName}</span>
                              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusMeta.tone}`}>
                                {statusMeta.label}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">{statusMeta.detail}</div>
                          </div>
                          <button type="button" onClick={() => removeBill(bill.id)} className="text-slate-400 transition-colors hover:text-red-500">
                            <TrashIcon />
                          </button>
                        </div>
                        <div className="mt-3">
                          <StepRail step={statusMeta.step} />
                        </div>
                      </div>

                      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_440px]">
                        <div className="grid grid-cols-2 gap-x-8 gap-y-4 lg:grid-cols-2">
                          <EditableField label="Bill No." value={bill.billNo} onChange={(value) => updateField(bill.id, "billNo", value)} />
                          <EditableField label="Invoice Date" value={bill.invoiceDate} onChange={(value) => updateField(bill.id, "invoiceDate", value)} />
                          <EditableField label="Outlet Name" value={bill.outletName} onChange={(value) => updateField(bill.id, "outletName", value)} />
                          <EditableField label="GSTIN" value={bill.gstNo} onChange={(value) => updateField(bill.id, "gstNo", value)} />
                          <EditableField label="Salesman" value={bill.salesmanName} onChange={(value) => updateField(bill.id, "salesmanName", value)} />
                          <EditableField label="Beat" value={bill.beat} onChange={(value) => updateField(bill.id, "beat", value)} />
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Label Preview</div>
                              <div className="mt-1 text-xs text-slate-500">Monochrome 3 × 2 inch layout. This is the live output that will be printed.</div>
                            </div>
                            {previewLocked && (
                              <div className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 shadow-sm">
                                Updating
                              </div>
                            )}
                          </div>

                          <div className="mt-4 flex justify-center overflow-hidden">
                            <button
                              type="button"
                              onClick={() => openLabelPreview(bill)}
                              className="relative block w-full max-w-[372px] cursor-pointer rounded-xl transition-transform hover:scale-[1.01]"
                            >
                              <LabelCard bill={bill} index={index} />
                              {previewLocked && (
                                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-[1px]">
                                  <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm">
                                    <SpinnerIcon />
                                    Label preview is updating
                                  </div>
                                </div>
                              )}
                            </button>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => openLabelPreview(bill)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white"
                            >
                              <ExpandIcon /> Open Preview
                            </button>
                            {!previewLocked && (
                              <button
                                type="button"
                                onClick={() => downloadLabelPdf(bill)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white"
                              >
                                <DownloadIcon /> PDF
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {bills.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-center">
                <div className="mb-3 text-slate-300">
                  <svg viewBox="0 0 24 24" className="mx-auto h-12 w-12" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <path d="M3 7a2 2 0 0 1 2-2h9.586a2 2 0 0 1 1.414.586l3.414 3.414a2 2 0 0 1 0 2.828L15.414 18.41A2 2 0 0 1 14 19H5a2 2 0 0 1-2-2V7Z" />
                    <path d="M8 10h5M8 14h3" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-500">No bills uploaded yet</p>
                <p className="mt-1 text-xs text-slate-400">Upload bill images or PDFs to extract metadata and generate labels.</p>
              </div>
            )}
          </>
        )}

        {tab === "history" && (
          <>
            {historyLoading ? (
              <div className="flex items-center justify-center py-16 text-sm text-slate-500">
                <SpinnerIcon />
                <span className="ml-2">Loading history…</span>
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-center">
                <p className="text-sm font-medium text-slate-500">No saved labels in the last {HISTORY_WINDOW_DAYS} days</p>
                <p className="mt-1 text-xs text-slate-400">Metadata stays lightweight. Labels are generated on demand from what you saved.</p>
              </div>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between text-sm text-slate-500">
                  <span>{historyTotal} saved label{historyTotal !== 1 ? "s" : ""} from the last {HISTORY_WINDOW_DAYS} days</span>
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-400">No bill scans stored</span>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-left">
                        {sortableHistoryColumns.map((column) => {
                          const active = historySort.key === column.key;
                          return (
                            <th key={column.key} className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => toggleHistorySort(column.key)}
                                className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 transition-colors hover:text-slate-700"
                              >
                                <span>{column.label}</span>
                                <SortIcon active={active} direction={historySort.direction} />
                              </button>
                            </th>
                          );
                        })}
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((item) => (
                        <tr key={item.id} className="border-b border-slate-50 transition-colors hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-800">{item.billNo || "—"}</td>
                          <td className="px-4 py-3 text-slate-700">{item.outletName || "—"}</td>
                          <td className="px-4 py-3 text-slate-700">{item.gstNo || "—"}</td>
                          <td className="px-4 py-3 text-slate-700">{item.beat || "—"}</td>
                          <td className="px-4 py-3 text-slate-700">{item.invoiceDate || "—"}</td>
                          <td className="max-w-[180px] truncate px-4 py-3 text-slate-500">{item.fileName || "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openLabelPreview(item)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-white"
                              >
                                <ExpandIcon /> Expand
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadLabelPdf(item)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-white"
                              >
                                <DownloadIcon /> PDF
                              </button>
                              <button
                                type="button"
                                onClick={() => triggerPrint([item])}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-white"
                              >
                                <PrintIcon /> Print
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteHistoryItem(item.id)}
                                className="inline-flex items-center rounded-lg px-2 py-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                              >
                                <TrashIcon />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {historyTotal > PAGE_SIZE && (
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      Page {historyPage + 1} of {Math.ceil(historyTotal / PAGE_SIZE)}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={historyPage === 0}
                        onClick={() => loadHistory(historyPage - 1)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        disabled={(historyPage + 1) * PAGE_SIZE >= historyTotal}
                        onClick={() => loadHistory(historyPage + 1)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {expandedLabelPreview && (
        <Modal title="Label Preview" onClose={() => setExpandedLabelPreview(null)}>
          <div className="flex flex-col items-center gap-4">
            <LabelCard bill={expandedLabelPreview} width={540} />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => triggerPrint([expandedLabelPreview])}
                className="inline-flex items-center gap-2 rounded-lg border border-black px-4 py-2 text-sm font-semibold text-black hover:bg-slate-100"
              >
                <PrintIcon /> Print
              </button>
              <button
                type="button"
                onClick={() => downloadLabelPdf(expandedLabelPreview)}
                className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <DownloadIcon /> Download PDF
              </button>
            </div>
          </div>
        </Modal>
      )}

      <div id="print-area" className="hidden">
        {(printBills || doneBills).map((bill, index) => (
          <LabelCard key={`${bill.id}-${index}`} bill={bill} index={index} />
        ))}
      </div>
    </>
  );
}
