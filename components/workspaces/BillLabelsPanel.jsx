"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, apiEndpoints } from "@/lib/api";

const HISTORY_WINDOW_DAYS = 7;
const LABEL_WIDTH_IN = 3;
const LABEL_HEIGHT_IN = 2.25;
const PAGE_WIDTH_IN = 3;
const PAGE_HEIGHT_IN = 5;
const PAGE_VERTICAL_MARGIN_IN = 1 / 6;
const PAGE_LABEL_GAP_IN = 1 / 6;
const LABEL_PREVIEW_WIDTH = 372;
const LABEL_CANVAS_WIDTH = 900;
const LABEL_CANVAS_HEIGHT = 675;
const LABEL_BOTTOM_EXTRA = LABEL_CANVAS_HEIGHT - 600;
const PROCESS_CONCURRENCY = Math.min(4, Math.max(2, (typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 2));
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
      .replace(/\bAddress\b.*$/i, "")
      .replace(/\bPhone\s*No\b.*$/i, "")
      .replace(/\bState\b.*$/i, "")
      .replace(/\bSalesman(?:\s*Name)?\b.*$/i, "")
      .replace(/\bBeat(?:\s*Name)?\b.*$/i, "")
      .replace(/^[^A-Za-z0-9(]+/, "")
  );
}

function extractSectionValue(text, patterns, terminators = []) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      let value = match[1];
      if (terminators.length) {
        const terminatorPattern = new RegExp(`\\b(?:${terminators.join("|")})\\b`, "i");
        const terminatorMatch = value.match(terminatorPattern);
        if (terminatorMatch?.index != null) {
          value = value.slice(0, terminatorMatch.index);
        }
      }
      const normalized = normalizeText(value);
      if (normalized) return normalized;
    }
  }
  return "";
}

function parseBillText(raw) {
  const text = raw.replace(/\r\n/g, "\n");
  const inlineText = normalizeText(raw);
  const billNo = normalizeText(
    extractField(
      text,
      /Bill\s*No\.?\s*[:\-]?\s*([A-Z0-9\/\-]+)/i,
      /Bill\s*No\s*:\s*([A-Z0-9\/\-]+)/i,
      /Bill\s*No\.?\s*[:\-]?\s*([A-Z0-9\/\-]+)/i,
      /Invoice\s*No\.?\s*[:\-]?\s*([A-Z0-9\/\-]+)/i
    )
  );
  const invoiceDate = normalizeText(
    extractField(
      text,
      /Invoice\s*Date\s*[:\-]?\s*([0-9\-\/]+)/i,
      /Invoice\s*date\s*[:\-]?\s*([0-9\-\/]+)/i,
      /Date\s*[:\-]?\s*([0-9\-\/]+)/i
    )
  );
  const salesmanName = extractSectionValue(
    inlineText,
    [
      /\bSalesman\s*Name\s*[:\-]?\s*(.+)$/i,
      /\bSalesman\b\s*[:\-]?\s*(.+)$/i,
    ],
    ["Beat(?:\\s*Name)?", "Outlet\\s*Id", "Order\\s*Id", "SR\\s*No\\.?"]
  );
  const beat = extractSectionValue(
    inlineText,
    [
      /\bBeat(?:\s*Name)?\s*[:\-]?\s*(.+)$/i,
      /\bRoute\s*[:\-]?\s*(.+)$/i,
    ],
    ["Outlet\\s*Id", "Order\\s*Id", "Order\\s*Date", "SR\\s*No\\.?"]
  );
  const gstNo = normalizeGstNo(
    extractSectionValue(
      inlineText,
      [
        /\bTo\b\s*:?.*?\bGST(?:IN)?\s*(?:No\.?)?\s*[:\-]?\s*([0-9A-Z\s]{15,20})/i,
        /\bPhone\s*No\b\s*:?.*?\bGST(?:IN)?\s*(?:No\.?)?\s*[:\-]?\s*([0-9A-Z\s]{15,20})/i,
        /GST(?:IN)?\s*(?:No\.?)?\s*[:\-]?\s*([0-9A-Z\s]{15,20})/i,
      ]
    )
  );
  const outletName = cleanOutletCandidate(
    extractSectionValue(
      inlineText,
      [
        /\bTo\b\s*:?\s*(.+)$/i,
        /\bM\/s\.?\s*(.+)$/i,
        /\bCustomer\b\s*:?\s*(.+)$/i,
        /\bRetailer\b\s*:?\s*(.+)$/i,
      ],
      ["Address", "Phone\\s*No", "GST(?:IN)?\\s*No", "State", "Salesman(?:\\s*Name)?", "Beat(?:\\s*Name)?"]
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

function trimTextToWidth(text, measure, maxWidth) {
  const compact = normalizeText(text);
  if (!compact) return "";
  if (measure(compact) <= maxWidth) return compact;

  let trimmed = compact.replace(/…$/, "");
  while (trimmed && measure(`${trimmed}…`) > maxWidth) {
    trimmed = trimmed.slice(0, -1).trimEnd();
  }
  return trimmed ? `${trimmed}…` : "…";
}

function splitTokenToWidth(token, measure, maxWidth) {
  const compact = normalizeText(token);
  if (!compact) return [];
  if (measure(compact) <= maxWidth) return [compact];

  const parts = [];
  let remaining = compact;

  while (remaining) {
    let chunk = remaining;
    while (chunk.length > 1 && measure(chunk) > maxWidth) {
      chunk = chunk.slice(0, -1);
    }

    if (measure(chunk) > maxWidth) {
      chunk = remaining[0];
    }

    parts.push(chunk);
    remaining = remaining.slice(chunk.length);
  }

  return parts;
}

function wrapTextByMeasure(text, measure, maxWidth, maxLines = 3, ellipsize = true) {
  const words = normalizeText(text).split(" ").filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate) <= maxWidth) {
      current = candidate;
    } else if (!current) {
      const segments = splitTokenToWidth(word, measure, maxWidth);
      if (segments.length > 1) {
        lines.push(...segments.slice(0, -1));
      }
      current = segments.at(-1) || "";
    } else {
      lines.push(current);
      const segments = splitTokenToWidth(word, measure, maxWidth);
      if (segments.length > 1) {
        lines.push(...segments.slice(0, -1));
      }
      current = segments.at(-1) || "";
    }
  }
  if (current) lines.push(current);

  if (lines.length <= maxLines) {
    return lines.map((line) => trimTextToWidth(line, measure, maxWidth));
  }

  if (!ellipsize) {
    return lines.map((line) => trimTextToWidth(line, measure, maxWidth));
  }

  const visible = lines.slice(0, maxLines).map((line) => trimTextToWidth(line, measure, maxWidth));
  visible[maxLines - 1] = trimTextToWidth(`${visible[maxLines - 1]}…`, measure, maxWidth);
  return visible;
}

function getScaledLineHeight(size, baseFontSize, baseLineHeight) {
  const ratio = size / baseFontSize;
  return Math.max(size * 1.24, baseLineHeight * ratio);
}

function fitTextBlock(text, { fontSize, minFontSize, lineHeight, maxWidth, maxLines, measureFactory }) {
  const content = normalizeText(text) || "—";

  for (let size = fontSize; size >= minFontSize; size -= 1) {
    const measure = (value) => measureFactory(value, size);
    const lines = wrapTextByMeasure(content, measure, maxWidth, maxLines, false);
    if (lines.length <= maxLines && lines.every((line) => measure(line) <= maxWidth)) {
      return {
        lines,
        fontSize: size,
        lineHeight: getScaledLineHeight(size, fontSize, lineHeight),
      };
    }
  }

  const minSize = minFontSize;
  const measure = (value) => measureFactory(value, minSize);
  const allLines = wrapTextByMeasure(content, measure, maxWidth, maxLines, false);
  const lines = allLines.slice(0, maxLines);
  const visibleLines = lines.length
    ? lines.map((line, index) => trimTextToWidth(index === lines.length - 1 && allLines.length > maxLines ? `${line}…` : line, measure, maxWidth))
    : [trimTextToWidth(content, measure, maxWidth)];

  return {
    lines: visibleLines,
    fontSize: minSize,
    lineHeight: getScaledLineHeight(minSize, fontSize, lineHeight),
  };
}

function getFooterCode(billNo) {
  return (billNo || "XXXX")
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase()
    .padEnd(16, "0")
    .slice(0, 16);
}

function getPreviewTextLines(bill) {
  const measureFactory = (ratio) => (value, fontSize) => value.length * fontSize * ratio;

  return {
    outlet: fitTextBlock(bill.outletName || "Outlet Name", {
      fontSize: 42,
      minFontSize: 24,
      lineHeight: 46,
      maxWidth: 560,
      maxLines: 3,
      measureFactory: measureFactory(0.53),
    }),
    billNo: fitTextBlock(bill.billNo || "—", {
      fontSize: 26,
      minFontSize: 16,
      lineHeight: 30,
      maxWidth: 560,
      maxLines: 1,
      measureFactory: measureFactory(0.54),
    }),
    beat: fitTextBlock(bill.beat || "—", {
      fontSize: 26,
      minFontSize: 16,
      lineHeight: 30,
      maxWidth: 560,
      maxLines: 2,
      measureFactory: measureFactory(0.54),
    }),
    salesman: fitTextBlock(bill.salesmanName || "—", {
      fontSize: 26,
      minFontSize: 15,
      lineHeight: 28,
      maxWidth: 240,
      maxLines: 1,
      measureFactory: measureFactory(0.54),
    }),
    date: fitTextBlock(bill.invoiceDate || "—", {
      fontSize: 26,
      minFontSize: 18,
      lineHeight: 28,
      maxWidth: 180,
      maxLines: 1,
      measureFactory: measureFactory(0.54),
    }),
    qrBillNo: fitTextBlock(bill.billNo || "—", {
      fontSize: 20,
      minFontSize: 12,
      lineHeight: 22,
      maxWidth: 156,
      maxLines: 1,
      measureFactory: measureFactory(0.56),
    }),
  };
}

async function createLabelsPdf(rawBills) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdfDoc = await PDFDocument.create();
  const textFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const monoFont = await pdfDoc.embedFont(StandardFonts.CourierBold);
  const labels = await Promise.all(rawBills.map((bill) => ensureQrDataUrl(bill)));
  const pageWidth = PAGE_WIDTH_IN * 72;
  const pageHeight = PAGE_HEIGHT_IN * 72;
  const labelHeight = LABEL_HEIGHT_IN * 72;
  const pagePadding = PAGE_VERTICAL_MARGIN_IN * 72;
  const labelGap = PAGE_LABEL_GAP_IN * 72;
  const scale = pageWidth / LABEL_CANVAS_WIDTH;
  const px = (value) => value * scale;
  const yFromTop = (labelTop, top, fontSize) => pageHeight - labelTop - px(top) - fontSize;

  function drawFitted(page, font, text, x, labelTop, top, options) {
    const fitted = fitTextBlock(text, {
      ...options,
      measureFactory: (value, fontSize) => font.widthOfTextAtSize(value, fontSize),
    });
    fitted.lines.forEach((line, index) => {
      page.drawText(line, {
        x,
        y: yFromTop(labelTop, top + index * fitted.lineHeight, fitted.fontSize),
        size: fitted.fontSize,
        font,
        color: rgb(0.07, 0.07, 0.07),
      });
    });
    return fitted;
  }

  for (let index = 0; index < labels.length; index += 2) {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    const pageBills = labels.slice(index, index + 2);

    for (const [slotIndex, bill] of pageBills.entries()) {
      const absoluteIndex = index + slotIndex;
      const labelTop = pagePadding + slotIndex * (labelHeight + labelGap);
      const labelBottomY = pageHeight - labelTop - labelHeight;
      const qrTop = 172 + LABEL_BOTTOM_EXTRA / 2;
      const qrLabelY = 344 + LABEL_BOTTOM_EXTRA / 2;
      const qrImage = bill.qrDataUrl ? await pdfDoc.embedPng(bill.qrDataUrl) : null;
      const outletBlock = drawFitted(page, boldFont, bill.outletName || "Outlet Name", px(42), labelTop, 162, {
        fontSize: px(42),
        minFontSize: px(24),
        lineHeight: px(46),
        maxWidth: px(560),
        maxLines: 3,
      });
      const metaStartY = 162 + outletBlock.lines.length * (outletBlock.lineHeight / scale) + 24;
      const qrBillNo = fitTextBlock(bill.billNo || "—", {
        fontSize: px(20),
        minFontSize: px(12),
        lineHeight: px(22),
        maxWidth: px(156),
        maxLines: 1,
        measureFactory: (value, fontSize) => monoFont.widthOfTextAtSize(value, fontSize),
      });

      page.drawRectangle({ x: px(4), y: labelBottomY + px(4), width: pageWidth - px(8), height: labelHeight - px(8), borderWidth: px(8), borderColor: rgb(0.07, 0.07, 0.07) });
      page.drawRectangle({ x: 0, y: pageHeight - labelTop - px(90), width: pageWidth, height: px(90), color: rgb(0.07, 0.07, 0.07) });
      page.drawText("ASCEND FOODS", { x: px(40), y: yFromTop(labelTop, 36, px(28)), size: px(28), font: boldFont, color: rgb(1, 1, 1) });
      page.drawText(`Mob No. ${SUPPORT_MOBILE_NO}`, {
        x: pageWidth - px(34) - textFont.widthOfTextAtSize(`Mob No. ${SUPPORT_MOBILE_NO}`, px(16)),
        y: yFromTop(labelTop, 40, px(16)),
        size: px(16),
        font: textFont,
        color: rgb(1, 1, 1),
      });

      page.drawLine({ start: { x: px(670), y: pageHeight - labelTop - px(90) }, end: { x: px(670), y: labelBottomY + px(90 + LABEL_BOTTOM_EXTRA) }, thickness: px(3), color: rgb(0.45, 0.45, 0.45), dashArray: [px(10), px(10)] });
      page.drawText("DELIVER TO", { x: px(42), y: yFromTop(labelTop, 124, px(18)), size: px(18), font: boldFont, color: rgb(0.38, 0.38, 0.38) });
      page.drawText("BILL NO.", { x: px(42), y: yFromTop(labelTop, metaStartY, px(18)), size: px(18), font: boldFont, color: rgb(0.38, 0.38, 0.38) });
      drawFitted(page, boldFont, bill.billNo || "—", px(42), labelTop, metaStartY + 34, {
        fontSize: px(26),
        minFontSize: px(16),
        lineHeight: px(30),
        maxWidth: px(560),
        maxLines: 1,
      });

      page.drawText("BEAT", { x: px(42), y: yFromTop(labelTop, metaStartY + 86, px(18)), size: px(18), font: boldFont, color: rgb(0.38, 0.38, 0.38) });
      drawFitted(page, boldFont, bill.beat || "—", px(42), labelTop, metaStartY + 120, {
        fontSize: px(26),
        minFontSize: px(16),
        lineHeight: px(30),
        maxWidth: px(560),
        maxLines: 2,
      });

      page.drawLine({ start: { x: px(42), y: labelBottomY + px(152) }, end: { x: px(646), y: labelBottomY + px(152) }, thickness: px(2), color: rgb(0.67, 0.67, 0.67), dashArray: [px(8), px(8)] });
      page.drawText("SALESMAN", { x: px(42), y: yFromTop(labelTop, 474 + LABEL_BOTTOM_EXTRA, px(16)), size: px(16), font: boldFont, color: rgb(0.38, 0.38, 0.38) });
      page.drawText("DATE", { x: px(330), y: yFromTop(labelTop, 474 + LABEL_BOTTOM_EXTRA, px(16)), size: px(16), font: boldFont, color: rgb(0.38, 0.38, 0.38) });
      drawFitted(page, boldFont, bill.salesmanName || "—", px(42), labelTop, 510 + LABEL_BOTTOM_EXTRA, {
        fontSize: px(26),
        minFontSize: px(15),
        lineHeight: px(28),
        maxWidth: px(240),
        maxLines: 1,
      });
      drawFitted(page, boldFont, bill.invoiceDate || "—", px(330), labelTop, 510 + LABEL_BOTTOM_EXTRA, {
        fontSize: px(26),
        minFontSize: px(18),
        lineHeight: px(28),
        maxWidth: px(180),
        maxLines: 1,
      });

      if (qrImage) {
        page.drawRectangle({ x: px(712), y: yFromTop(labelTop, qrTop + 156, 0), width: px(156), height: px(156), borderWidth: px(2), borderColor: rgb(0.07, 0.07, 0.07) });
        page.drawImage(qrImage, { x: px(720), y: yFromTop(labelTop, qrTop + 140, 0), width: px(140), height: px(140) });
      } else {
        page.drawRectangle({ x: px(720), y: yFromTop(labelTop, qrTop + 140, 0), width: px(140), height: px(140), borderWidth: px(2), borderColor: rgb(0.3, 0.3, 0.3) });
      }

      page.drawText(qrBillNo.lines[0], { x: px(790) - monoFont.widthOfTextAtSize(qrBillNo.lines[0], qrBillNo.fontSize) / 2, y: yFromTop(labelTop, qrLabelY, qrBillNo.fontSize), size: qrBillNo.fontSize, font: monoFont, color: rgb(0.07, 0.07, 0.07) });
      page.drawRectangle({ x: 0, y: labelBottomY, width: pageWidth, height: px(60), color: rgb(0.94, 0.94, 0.94) });
      page.drawLine({ start: { x: 0, y: labelBottomY + px(60) }, end: { x: pageWidth, y: labelBottomY + px(60) }, thickness: px(4), color: rgb(0.07, 0.07, 0.07) });
      page.drawText(getFooterCode(bill.billNo), { x: px(40), y: yFromTop(labelTop, 560 + LABEL_BOTTOM_EXTRA, px(20)), size: px(20), font: monoFont, color: rgb(0.07, 0.07, 0.07) });
      page.drawText(String(absoluteIndex + 1), { x: pageWidth - px(32), y: yFromTop(labelTop, 560 + LABEL_BOTTOM_EXTRA, px(18)), size: px(18), font: textFont, color: rgb(0.42, 0.42, 0.42) });
    }
  }

  return pdfDoc.save();
}

async function pdfToBillStartPages(file, onProgress) {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    disableWorker: true,
    disableRange: true,
    disableStream: true,
    disableAutoFetch: true,
    useWorkerFetch: false,
  }).promise;
  const startPages = [];
  const pageTextByNumber = new Map();

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const pageText = await extractPageText(page);
    pageTextByNumber.set(i, pageText);

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
  const pages = pageNumbers.map((pageNum, index) => {
    onProgress?.({
      phase: "extract",
      current: index + 1,
      total: pageNumbers.length,
      selected: pageNumbers.length,
      sourcePage: pageNum,
      usedFallback: !startPages.length,
    });
    return { pageNum, pageText: pageTextByNumber.get(pageNum) || "" };
  });

  return pages;
}

async function extractPageText(page) {
  const stream = page.streamTextContent();
  const reader = stream.getReader();
  const items = [];

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value?.items?.length) items.push(...value.items);
  }

  return items
    .map((item) => ("str" in item ? item.str : ""))
    .join(" ");
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

async function processWithConcurrency(items, worker, limit = PROCESS_CONCURRENCY) {
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
        detail: "Waiting to extract PDF text",
        tone: "bg-slate-100 text-slate-600",
      };
    case "processing":
      return {
        label: "Extracting",
        detail: "PDF text scan and label prep running",
        tone: "bg-slate-100 text-slate-700",
      };
    case "saving":
      return {
        label: "Saving",
        detail: "Automatically saving to history",
        tone: "bg-slate-100 text-slate-700",
      };
    case "saved":
      return {
        label: "Saved",
        detail: "Available in 7-day history",
        tone: "bg-slate-900 text-white",
      };
    case "save_error":
      return {
        label: "Error",
        detail: "Could not save this label.",
        tone: "bg-red-100 text-red-700",
      };
    default:
      return {
        label: "Error",
        detail: "Could not extract this label from the PDF.",
        tone: "bg-red-100 text-red-700",
      };
  }
}

function ReadOnlyField({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</span>
      <span className="text-sm font-medium leading-snug text-slate-800">{value || <span className="italic text-slate-400">—</span>}</span>
    </div>
  );
}

function LabelCard({ bill, index = 0, width = LABEL_PREVIEW_WIDTH }) {
  const { outlet, billNo, beat, salesman, date, qrBillNo } = getPreviewTextLines(bill);
  const metaStartY = 162 + outlet.lines.length * outlet.lineHeight + 24;
  const dividerY = 448 + LABEL_BOTTOM_EXTRA;
  const lowerSectionTop = 490 + LABEL_BOTTOM_EXTRA;
  const lowerValueTop = 524 + LABEL_BOTTOM_EXTRA;
  const qrTop = 172 + LABEL_BOTTOM_EXTRA / 2;
  const qrLabelY = 360 + LABEL_BOTTOM_EXTRA / 2;
  const footerTop = 540 + LABEL_BOTTOM_EXTRA;
  const footerTextY = 578 + LABEL_BOTTOM_EXTRA;

  return (
    <div
      className="label-card overflow-hidden rounded-[14px] border-[3px] border-black bg-white text-black shadow-sm"
      style={{
        width,
        maxWidth: "100%",
        aspectRatio: `${LABEL_WIDTH_IN} / ${LABEL_HEIGHT_IN}`,
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

        <line x1="670" y1="90" x2="670" y2={510 + LABEL_BOTTOM_EXTRA} stroke="#666666" strokeWidth="3" strokeDasharray="10 10" />

        <text x="42" y="142" fill="#666666" fontSize="18" fontWeight="700" fontFamily="'Helvetica Neue', Arial, sans-serif" letterSpacing="1.4">
          DELIVER TO
        </text>
        {outlet.lines.map((line, lineIndex) => (
          <text
            key={`outlet-${lineIndex}`}
            x="42"
            y={190 + lineIndex * outlet.lineHeight}
            fill="#111111"
            fontSize={outlet.fontSize}
            fontWeight="700"
            fontFamily="'Helvetica Neue', Arial, sans-serif"
          >
            {line}
          </text>
        ))}

        <text x="42" y={metaStartY} fill="#666666" fontSize="18" fontWeight="700" fontFamily="'Helvetica Neue', Arial, sans-serif" letterSpacing="1.4">
          BILL NO.
        </text>
        {billNo.lines.map((line, lineIndex) => (
          <text
            key={`bill-no-${lineIndex}`}
            x="42"
            y={metaStartY + 34 + lineIndex * billNo.lineHeight}
            fill="#111111"
            fontSize={billNo.fontSize}
            fontWeight="700"
            fontFamily="'Helvetica Neue', Arial, sans-serif"
          >
            {line}
          </text>
        ))}

        <text x="42" y={metaStartY + 86} fill="#666666" fontSize="18" fontWeight="700" fontFamily="'Helvetica Neue', Arial, sans-serif" letterSpacing="1.4">
          BEAT
        </text>
        {beat.lines.map((line, lineIndex) => (
          <text
            key={`beat-${lineIndex}`}
            x="42"
            y={metaStartY + 120 + lineIndex * beat.lineHeight}
            fill="#111111"
            fontSize={beat.fontSize}
            fontWeight="700"
            fontFamily="'Helvetica Neue', Arial, sans-serif"
          >
            {line}
          </text>
        ))}

        <line x1="42" y1={dividerY} x2="646" y2={dividerY} stroke="#aaaaaa" strokeWidth="2" strokeDasharray="8 8" />

        <text x="42" y={lowerSectionTop} fill="#666666" fontSize="16" fontWeight="700" fontFamily="'Helvetica Neue', Arial, sans-serif" letterSpacing="1.2">
          SALESMAN
        </text>
        <text x="330" y={lowerSectionTop} fill="#666666" fontSize="16" fontWeight="700" fontFamily="'Helvetica Neue', Arial, sans-serif" letterSpacing="1.2">
          DATE
        </text>
        {salesman.lines.map((line, lineIndex) => (
          <text
            key={`salesman-${lineIndex}`}
            x="42"
            y={lowerValueTop + lineIndex * salesman.lineHeight}
            fill="#111111"
            fontSize={salesman.fontSize}
            fontWeight="700"
            fontFamily="'Helvetica Neue', Arial, sans-serif"
          >
            {line}
          </text>
        ))}
        {date.lines.map((line, lineIndex) => (
          <text
            key={`date-${lineIndex}`}
            x="330"
            y={lowerValueTop + lineIndex * date.lineHeight}
            fill="#111111"
            fontSize={date.fontSize}
            fontWeight="700"
            fontFamily="'Helvetica Neue', Arial, sans-serif"
          >
            {line}
          </text>
        ))}

        <rect x="712" y={qrTop} width="156" height="156" fill="#ffffff" stroke="#111111" strokeWidth="2" />
        {bill.qrDataUrl ? (
          <image href={bill.qrDataUrl} x="720" y={qrTop + 8} width="140" height="140" preserveAspectRatio="xMidYMid meet" />
        ) : (
          <text x="790" y={qrTop + 86} fill="#666666" fontSize="18" fontWeight="700" textAnchor="middle" fontFamily="'Helvetica Neue', Arial, sans-serif">
            QR
          </text>
        )}
        {qrBillNo.lines.map((line, lineIndex) => (
          <text key={`qr-bill-${lineIndex}`} x="790" y={qrLabelY + lineIndex * qrBillNo.lineHeight} fill="#111111" fontSize={qrBillNo.fontSize} fontWeight="700" fontFamily="'Courier New', monospace" textAnchor="middle">
            {line}
          </text>
        ))}

        <rect x="0" y={footerTop} width={LABEL_CANVAS_WIDTH} height="60" fill="#efefef" />
        <line x1="0" y1={footerTop} x2={LABEL_CANVAS_WIDTH} y2={footerTop} stroke="#111111" strokeWidth="4" />
        <text x="40" y={footerTextY} fill="#111111" fontSize="20" fontWeight="700" fontFamily="'Courier New', monospace" letterSpacing="1.8">
          {getFooterCode(bill.billNo)}
        </text>
        <text x="868" y={footerTextY} fill="#666666" fontSize="18" fontFamily="'Helvetica Neue', Arial, sans-serif" textAnchor="end">
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
      detail: "Reading PDFs and identifying the first page of each invoice before extraction starts.",
      progress: 2,
    });

    for (const [fileIndex, file] of selectedFiles.entries()) {
      if (file.type === "application/pdf") {
        try {
          const pages = await pdfToBillStartPages(file, ({ phase, current, total, selected, sourcePage, usedFallback }) => {
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
                  : `Extracting bill ${current} of ${total} from PDF page ${sourcePage}`,
              progress: Math.max(4, progress),
            });
          });
          for (const page of pages) {
            toProcess.push({
              id: `${Date.now()}-${Math.random()}`,
              fileName: `${file.name} — page ${page.pageNum}`,
              sourceText: page.pageText,
            });
          }
        } catch (error) {
          console.error("PDF parsing failed for", file.name, error);
          toProcess.push({
              id: `${Date.now()}-${Math.random()}`,
              fileName: file.name,
              forceError: true,
            });
        }
      }
    }

    const newEntries = toProcess.map((item) => ({
      id: item.id,
      fileName: item.fileName,
      sourceText: item.sourceText || "",
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
      detail: "Starting PDF text extraction and generating live previews.",
      progress: 100,
    });
    setBills((prev) => [...prev, ...newEntries]);
    uploadProgressTimeoutRef.current = setTimeout(() => setUploadProgress(null), 400);

    await processWithConcurrency(
      newEntries.filter((entry) => entry.status !== "error"),
      async (entry) => {
        setBills((prev) => prev.map((bill) => (bill.id === entry.id ? { ...bill, status: "processing" } : bill)));

        try {
          const parsedFields = parseBillText(entry.sourceText || "");
          const parsed = await ensureQrDataUrl({ ...entry, ...parsedFields });
          const nextBill = { ...parsed, status: "saving" };
          setBills((prev) => prev.map((bill) => (
            bill.id === entry.id ? { ...bill, ...nextBill } : bill
          )));
          schedulePersistBill(nextBill, 80);
        } catch (error) {
          console.error("PDF text extraction failed for", entry.fileName, error);
          setBills((prev) => prev.map((bill) => (bill.id === entry.id ? { ...bill, status: "error" } : bill)));
        }
      }
    );
  }, [schedulePersistBill]);

  const onDrop = useCallback((event) => {
    event.preventDefault();
    setDragging(false);
    const files = [...event.dataTransfer.files].filter(
      (file) => file.type === "application/pdf"
    );
    if (files.length) processFiles(files);
  }, [processFiles]);

  const onFileChange = useCallback((event) => {
    const files = [...event.target.files].filter((file) => file.type === "application/pdf");
    if (files.length) processFiles(files);
    event.target.value = "";
  }, [processFiles]);

  const removeBill = (id) => {
    if (persistBillTimeoutsRef.current[id]) {
      clearTimeout(persistBillTimeoutsRef.current[id]);
      delete persistBillTimeoutsRef.current[id];
    }
    setBills((prev) => prev.filter((bill) => bill.id !== id));
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

  const doneBills = bills.filter((bill) => bill.status === "saving" || bill.status === "saved" || bill.status === "save_error");
  const visiblePrintBills = printBills || doneBills;
  const printSheets = visiblePrintBills.reduce((groups, bill, index) => {
    if (index % 2 === 0) groups.push([bill]);
    else groups[groups.length - 1].push(bill);
    return groups;
  }, []);
  const totalBills = bills.length;
  const processingCount = bills.filter((bill) => bill.status === "processing" || bill.status === "queued").length;
  const failedCount = bills.filter((bill) => bill.status === "error" || bill.status === "save_error").length;
  const extractedCount = totalBills - processingCount;
  const extractionProgress = totalBills ? Math.round((extractedCount / totalBills) * 100) : 0;
  const batchMessage = processingCount > 0
    ? "Keep this tab open while PDF text extraction runs. Label previews update automatically as each bill finishes."
    : failedCount > 0
      ? "Some labels could not be processed. Use the error flag to spot them."
      : doneBills.length > 0
        ? "This batch is saved. You can reopen, print, or download labels from History for 7 days."
        : "Upload PDFs to extract label fields and generate label previews.";

  return (
    <>
      <style>{`
        @page {
          size: ${PAGE_WIDTH_IN}in ${PAGE_HEIGHT_IN}in;
          margin: 0;
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
            width: ${PAGE_WIDTH_IN}in;
            padding: 0;
          }

          .print-sheet {
            display: flex !important;
            width: ${PAGE_WIDTH_IN}in;
            height: ${PAGE_HEIGHT_IN}in;
            flex-direction: column;
            gap: ${PAGE_LABEL_GAP_IN}in;
            padding: ${PAGE_VERTICAL_MARGIN_IN}in 0;
            break-after: page;
            page-break-after: always;
          }

          .label-card {
            width: ${LABEL_WIDTH_IN}in !important;
            min-height: ${LABEL_HEIGHT_IN}in !important;
            height: ${LABEL_HEIGHT_IN}in !important;
            break-inside: avoid;
            margin: 0 !important;
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
              PDFs are processed in the browser from embedded page text, only label metadata is saved, and labels are generated as monochrome {LABEL_WIDTH_IN} × {LABEL_HEIGHT_IN} inch labels with two labels on each {PAGE_WIDTH_IN} × {PAGE_HEIGHT_IN} inch page.
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
                accept="application/pdf"
                className="hidden"
                onChange={onFileChange}
              />
              <div className="mb-2 text-slate-400"><UploadIcon /></div>
              <p className="text-sm font-semibold text-slate-700">Drop bill PDFs here, or click to browse</p>
              <p className="mt-1 text-xs text-slate-400">Supports PDF only. Each PDF is scanned for invoice-start pages, then label fields are parsed directly from embedded page text.</p>
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

                <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-4 py-4">
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
                      </div>

                      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_440px]">
                        <div className="grid grid-cols-2 gap-x-8 gap-y-4 lg:grid-cols-2">
                          <ReadOnlyField label="Bill No." value={bill.billNo} />
                          <ReadOnlyField label="Invoice Date" value={bill.invoiceDate} />
                          <ReadOnlyField label="Outlet Name" value={bill.outletName} />
                          <ReadOnlyField label="GSTIN" value={bill.gstNo} />
                          <ReadOnlyField label="Salesman" value={bill.salesmanName} />
                          <ReadOnlyField label="Beat" value={bill.beat} />
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Label Preview</div>
                              <div className="mt-1 text-xs text-slate-500">Monochrome {LABEL_WIDTH_IN} × {LABEL_HEIGHT_IN} inch layout. Two labels are placed on each {PAGE_WIDTH_IN} × {PAGE_HEIGHT_IN} inch print page.</div>
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
                <p className="mt-1 text-xs text-slate-400">Upload PDFs to extract label data and generate labels.</p>
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
        {printSheets.map((sheet, sheetIndex) => (
          <div key={`print-sheet-${sheetIndex}`} className="print-sheet">
            {sheet.map((bill, index) => (
              <LabelCard key={`${bill.id}-${sheetIndex}-${index}`} bill={bill} index={sheetIndex * 2 + index} />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
