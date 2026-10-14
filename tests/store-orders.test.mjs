// Behaviour tests for the retailer's own order history and detail decisions. node:test, no
// framework, no network:
//
//   node --test tests/store-orders.test.mjs
//
// Every test drives the real exports from lib/store/orders.mjs. The backend is the authority for
// who may read an order and what it contains; this module only decides how an answer is worded
// and ordered: which backend status is which stage, what item_count counts, how a failed request
// differs from an empty list, and whether a malformed answer is believed at all.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ORDER_PAGE_SIZE,
  ORDER_STAGES,
  describeInvoiceError,
  describeOrderError,
  downloadInvoice,
  formatOrderDate,
  formatShipTo,
  invoiceFilename,
  invoiceNote,
  normalizeOrderDetail,
  normalizeOrderList,
  orderHref,
  orderListPath,
  orderReference,
  orderSummaryLabel,
  parseOrderId,
  parseOrderPage,
  productCountLabel,
  shouldRefreshOnFocus,
  sortOrdersNewest,
  statusLabel,
  statusProgress,
  totalOrderPages
} from "../lib/store/orders.mjs";

const order = (id, created_at, extra = {}) => ({
  id,
  status: "PENDING",
  created_at,
  item_count: 2,
  total: 100,
  delivery_charge: 0,
  invoice_available: false,
  ...extra
});

// ---- the six backend statuses ------------------------------------------------------------------------

test("every backend status has its approved wording", () => {
  assert.equal(statusLabel("PENDING"), "Placed");
  assert.equal(statusLabel("READY_TO_SHIP"), "Ready to ship");
  assert.equal(statusLabel("OUT_FOR_DELIVERY"), "Out for delivery");
  assert.equal(statusLabel("DELIVERED"), "Delivered");
  assert.equal(statusLabel("CANCELLED"), "Cancelled");
  assert.equal(statusLabel("RETURNED"), "Returned");
});

test("a status the app does not know is never worded as a real stage", () => {
  assert.equal(statusLabel("PACKING"), "Status unavailable");
  assert.equal(statusLabel(undefined), "Status unavailable");
  assert.equal(statusLabel(null), "Status unavailable");
  assert.equal(statusLabel("pending"), "Status unavailable", "the enum is upper case; a different case is not guessed");
});

test("the progression is exactly the four actual stages, in order", () => {
  assert.deepEqual(
    ORDER_STAGES.map((stage) => stage.status),
    ["PENDING", "READY_TO_SHIP", "OUT_FOR_DELIVERY", "DELIVERED"]
  );
  assert.deepEqual(
    ORDER_STAGES.map((stage) => stage.label),
    ["Placed", "Ready to ship", "Out for delivery", "Delivered"]
  );
});

test("a placed order has Placed as its current stage and nothing after it is complete", () => {
  const progress = statusProgress("PENDING");
  assert.equal(progress.interrupted, null);
  assert.deepEqual(
    progress.stages.map((stage) => stage.state),
    ["current", "upcoming", "upcoming", "upcoming"]
  );
});

test("a later stage completes the earlier ones and leaves later ones upcoming", () => {
  assert.deepEqual(
    statusProgress("OUT_FOR_DELIVERY").stages.map((stage) => stage.state),
    ["done", "done", "current", "upcoming"]
  );
  assert.deepEqual(
    statusProgress("DELIVERED").stages.map((stage) => stage.state),
    ["done", "done", "done", "current"]
  );
});

test("cancelled and returned interrupt the progression instead of completing or hiding stages", () => {
  for (const status of ["CANCELLED", "RETURNED"]) {
    const progress = statusProgress(status);
    assert.deepEqual(progress.stages, [], `${status} must not show a ladder of stages`);
    assert.equal(progress.interrupted.status, status);
    assert.equal(progress.interrupted.label, statusLabel(status));
  }
});

test("an unknown status shows no ladder and no interruption", () => {
  const progress = statusProgress("SOMETHING_NEW");
  assert.deepEqual(progress.stages, []);
  assert.equal(progress.interrupted, null);
});

// ---- newest first ---------------------------------------------------------------------------------------

test("newest first uses the real created_at, then the higher id", () => {
  const sorted = sortOrdersNewest([
    order(5, "2026-09-01T10:00:00+00:00"),
    order(9, "2026-09-03T10:00:00+00:00"),
    order(7, "2026-09-03T10:00:00+00:00"),
    order(8, "2026-09-02T10:00:00+00:00")
  ]);
  assert.deepEqual(
    sorted.map((o) => o.id),
    [9, 7, 8, 5]
  );
});

test("an order with no readable date sorts after dated ones, by id", () => {
  const sorted = sortOrdersNewest([order(3, null), order(1, "2026-01-01T00:00:00+00:00"), order(4, "not a date"), order(2, undefined)]);
  assert.deepEqual(
    sorted.map((o) => o.id),
    [1, 4, 3, 2]
  );
});

test("sorting never changes the list it was given", () => {
  const given = Object.freeze([order(1, "2026-01-01T00:00:00Z"), order(2, "2026-02-01T00:00:00Z")]);
  const sorted = sortOrdersNewest(given);
  assert.notEqual(sorted, given);
  assert.deepEqual(
    given.map((o) => o.id),
    [1, 2]
  );
});

test("a date with no zone is read as UTC, the same on every device", () => {
  const withZone = sortOrdersNewest([order(1, "2026-09-03T10:00:00"), order(2, "2026-09-03T10:00:00+00:00")]);
  assert.deepEqual(
    withZone.map((o) => o.id),
    [2, 1],
    "equal instants fall back to the higher id, so 10:00 with no zone equals 10:00 UTC"
  );
});

// ---- wording: products are lines, packets are quantities ---------------------------------------------

test("item_count is worded as products, never packets", () => {
  assert.equal(productCountLabel(1), "1 product");
  assert.equal(productCountLabel(3), "3 products");
  assert.equal(productCountLabel(0), "0 products");
  assert.doesNotMatch(orderSummaryLabel({ id: 12, item_count: 3 }), /packet/i);
  assert.match(orderSummaryLabel({ id: 12, item_count: 3 }), /3 products/);
});

test("an unknown product count is left out, not shown as zero", () => {
  assert.equal(productCountLabel(null), "");
  assert.equal(productCountLabel(undefined), "");
  assert.equal(productCountLabel(2.5), "");
  assert.equal(orderSummaryLabel({ id: 12 }), "Order #12");
});

test("the order id is the reference", () => {
  assert.equal(orderReference(1042), "Order #1042");
  assert.equal(orderHref(1042), "/orders/1042");
});

test("dates are the retailer's calendar day in India", () => {
  assert.match(formatOrderDate("2026-10-02T20:00:00+00:00"), /^0?3 Oct 2026$/, "20:00 UTC is already 3 October in India");
  assert.match(formatOrderDate("2026-10-02T10:00:00+00:00"), /^0?2 Oct 2026$/);
  assert.equal(formatOrderDate(null), "");
  assert.equal(formatOrderDate("nonsense"), "");
});

// ---- paging ------------------------------------------------------------------------------------------------

test("a page number is a positive whole number or the first page", () => {
  assert.equal(parseOrderPage("3"), 3);
  assert.equal(parseOrderPage(["2", "7"]), 2);
  for (const bad of [undefined, null, "", "0", "-1", "1.5", "abc", "2e3", "99999999999"]) {
    assert.equal(parseOrderPage(bad), 1, `${JSON.stringify(bad)} is the first page`);
  }
});

test("the list request carries a bounded limit and the page's offset only", () => {
  assert.equal(ORDER_PAGE_SIZE, 20);
  assert.equal(orderListPath(1), "/store/orders?limit=20&offset=0");
  assert.equal(orderListPath(3), "/store/orders?limit=20&offset=40");
});

test("the number of pages comes from the server's total", () => {
  assert.equal(totalOrderPages(0), 0);
  assert.equal(totalOrderPages(1), 1);
  assert.equal(totalOrderPages(20), 1);
  assert.equal(totalOrderPages(21), 2);
  assert.equal(totalOrderPages(undefined), 0);
});

// ---- the route parameter ------------------------------------------------------------------------------------

test("only a plain positive whole number can be an order id", () => {
  assert.equal(parseOrderId("42"), 42);
  for (const bad of [undefined, null, "", "0", "-5", "4.2", "abc", "1/../2", "42abc", " 42", "99999999999999"]) {
    assert.equal(parseOrderId(bad), null, `${JSON.stringify(bad)} is not an order id`);
  }
});

// ---- believing an answer -----------------------------------------------------------------------------------

test("a list answer is kept only if it has the documented shape", () => {
  assert.equal(normalizeOrderList(null), null);
  assert.equal(normalizeOrderList("<html>"), null);
  assert.equal(normalizeOrderList({ items: "x", total: 1 }), null);
  assert.equal(normalizeOrderList({ items: [], total: "many" }), null);
  assert.deepEqual(normalizeOrderList({ items: [], total: 0 }), { items: [], total: 0 });
});

test("list rows keep known fields, drop broken rows and repeats, and arrive newest first", () => {
  const list = normalizeOrderList({
    total: 4,
    items: [
      order(1, "2026-01-01T00:00:00+00:00"),
      { id: "x", status: "PENDING" },
      null,
      order(2, "2026-02-01T00:00:00+00:00", { secret: "not kept" }),
      order(2, "2026-02-01T00:00:00+00:00")
    ]
  });
  assert.deepEqual(
    list.items.map((o) => o.id),
    [2, 1]
  );
  assert.equal(list.total, 4, "the server's total is kept: it counts all pages");
  assert.equal("secret" in list.items[0], false);
});

test("missing optional list fields become null rather than invented values", () => {
  const list = normalizeOrderList({ total: 1, items: [{ id: 7, status: "DELIVERED" }] });
  assert.deepEqual(list.items[0], {
    id: 7,
    status: "DELIVERED",
    created_at: null,
    item_count: null,
    total: null,
    delivery_charge: null,
    invoice_available: false
  });
});

test("a detail answer is believed only with an id, a status and lines", () => {
  assert.equal(normalizeOrderDetail(null), null);
  assert.equal(normalizeOrderDetail({}), null);
  assert.equal(normalizeOrderDetail({ id: 1, status: "PENDING", lines: "x" }), null);
  assert.equal(normalizeOrderDetail({ id: "1", status: "PENDING", lines: [] }), null);
  assert.ok(normalizeOrderDetail({ id: 1, status: "PENDING", lines: [] }));
});

test("detail keeps the order's own snapshot and packet quantities", () => {
  const detail = normalizeOrderDetail({
    id: 31,
    status: "READY_TO_SHIP",
    created_at: "2026-09-03T10:00:00+00:00",
    lines: [
      { sku_id: 9, name: "Salted chips", image_url: null, pack_size: "52 g", pack_type: "ladi", units_per_pack: 12, quantity: 12, mrp: 20, line_total: 240 },
      { sku_id: 0, quantity: 3 },
      { sku_id: 10, quantity: 0 },
      { sku_id: 11, quantity: 2.5 }
    ],
    subtotal: 240,
    delivery_charge: 40,
    total: 280,
    ship_to: { label: "Shop", line1: "12 Market Road", city: "Pune", state: "Maharashtra", pincode: 411001 },
    invoice_available: true
  });
  assert.equal(detail.lines.length, 1, "lines without a real SKU or a whole positive quantity are not shown");
  assert.equal(detail.lines[0].quantity, 12);
  assert.equal(detail.lines[0].pack_type, "ladi");
  assert.equal(detail.lines[0].units_per_pack, 12);
  assert.equal(detail.total, 280);
  assert.equal(detail.subtotal, 240);
  assert.equal(detail.delivery_charge, 40);
  assert.equal(detail.ship_to.line1, "12 Market Road");
  assert.equal(detail.invoice_available, true);
});

test("a detail with missing optional fields still renders: nulls, not crashes", () => {
  const detail = normalizeOrderDetail({ id: 5, status: "PENDING", lines: [{ sku_id: 1, quantity: 1 }] });
  assert.equal(detail.created_at, null);
  assert.equal(detail.total, null);
  assert.equal(detail.lines[0].name, null);
  assert.deepEqual(formatShipTo(detail.ship_to), { label: null, lines: [] });
});

test("the Ship to snapshot is formatted from the order, line by line, long text intact", () => {
  const long = "Unit 14, Shree Ganesh Commercial Complex, Opposite the Old Municipal Bus Depot, Near the Railway Crossing";
  const formatted = formatShipTo({
    label: "Main shop",
    line1: long,
    line2: "Ground floor",
    landmark: "Next to the temple",
    city: "Pune",
    state: "Maharashtra",
    pincode: 411001
  });
  assert.equal(formatted.label, "Main shop");
  assert.deepEqual(formatted.lines, [long, "Ground floor", "Landmark: Next to the temple", "Pune, Maharashtra 411001"]);
});

// ---- failure is not emptiness -------------------------------------------------------------------------------

test("a missing or foreign order is unavailable, and says nothing about which", () => {
  const described = describeOrderError({ status: 404, message: "Order not found" }, "order");
  assert.equal(described.kind, "unavailable");
  assert.doesNotMatch(described.message, /another|retailer|forbidden|not found/i);
});

test("a stale answer is ignored, and an ended session is a sign-in matter", () => {
  assert.equal(describeOrderError({ reason: "stale" }, "orders").kind, "stale");
  assert.equal(describeOrderError({ status: 401, reason: "session-expired" }, "orders").kind, "signed-out");
  assert.equal(describeOrderError({ status: 401, reason: "needs-login" }, "orders").kind, "signed-out");
});

test("a server or network failure is a retryable failure with the right subject", () => {
  const orders = describeOrderError({ status: 500 }, "orders");
  assert.equal(orders.kind, "failed");
  assert.match(orders.message, /orders/i);
  const network = describeOrderError({ reason: "network" }, "order");
  assert.equal(network.kind, "failed");
  assert.match(network.message, /connection/i);
  assert.match(describeOrderError(new Error("boom"), "order").message, /order/i);
});

// ---- refresh on focus ----------------------------------------------------------------------------------------

test("returning to the tab refreshes, but not again straight away", () => {
  assert.equal(shouldRefreshOnFocus({ lastAt: null, now: 1000 }), true);
  assert.equal(shouldRefreshOnFocus({ lastAt: 1000, now: 4000 }), false);
  assert.equal(shouldRefreshOnFocus({ lastAt: 1000, now: 11000 }), true);
  assert.equal(shouldRefreshOnFocus({ lastAt: 1000, now: 2000, minGap: 500 }), true);
});

// ======================================================================================================
// Issued invoice: when it is offered, what it is called, how it is handed to the browser
// ======================================================================================================

const PDF_COPY = "Your invoice will be available after dispatch.";

test("an issued invoice is offered for download", () => {
  for (const status of ["PENDING", "READY_TO_SHIP", "OUT_FOR_DELIVERY", "DELIVERED", "RETURNED", "CANCELLED"]) {
    assert.deepEqual(invoiceNote({ status, invoice_available: true }), { kind: "download" }, status);
  }
});

test("before dispatch, no invoice is explained, not hidden", () => {
  for (const status of ["PENDING", "READY_TO_SHIP"]) {
    assert.deepEqual(invoiceNote({ status, invoice_available: false }), { kind: "pending", text: PDF_COPY }, status);
  }
});

test("where no dispatch is coming or it has already happened, no promise is made", () => {
  for (const status of ["CANCELLED", "RETURNED", "OUT_FOR_DELIVERY", "DELIVERED", "SOMETHING_NEW"]) {
    assert.deepEqual(invoiceNote({ status, invoice_available: false }), { kind: "none" }, status);
  }
});

test("an invoice is only offered on the server's say-so, never inferred from status", () => {
  assert.equal(invoiceNote({ status: "DELIVERED" }).kind, "none");
  assert.equal(invoiceNote({ status: "DELIVERED", invoice_available: "yes" }).kind, "none");
  assert.equal(invoiceNote(null).kind, "none");
});

test("the server's filename is kept", () => {
  assert.equal(invoiceFilename("INV-2026-0042.pdf", 12), "INV-2026-0042.pdf");
});

test("with no usable filename the order id names the file", () => {
  for (const missing of [undefined, null, "", "download", "   "]) {
    assert.equal(invoiceFilename(missing, 12), "invoice-12.pdf", JSON.stringify(missing));
  }
});

test("a filename can never carry a path, control characters or a missing extension", () => {
  assert.equal(invoiceFilename("../../etc/passwd", 12), "passwd.pdf");
  assert.equal(invoiceFilename("C:\\temp\\INV-7.pdf", 12), "INV-7.pdf");
  assert.equal(invoiceFilename("INV\u0000-7\n.pdf", 12), "INV-7.pdf");
  assert.equal(invoiceFilename("INV-7", 12), "INV-7.pdf");
  assert.equal(invoiceFilename("INV-7.PDF", 12), "INV-7.PDF");
  assert.ok(invoiceFilename("x".repeat(500) + ".pdf", 12).length <= 120);
  assert.match(invoiceFilename("/", 12), /^invoice-12\.pdf$/);
});

// An injected browser: a document that records the anchor it is given, and a URL that records what
// was created and revoked. Nothing here is a real DOM; it is exactly the surface downloadInvoice uses.
function fakeBrowser({ clickThrows = false } = {}) {
  const events = [];
  const anchor = {
    style: {},
    set href(value) { this._href = value; },
    get href() { return this._href; },
    click() {
      events.push("click");
      if (clickThrows) throw new Error("click blocked");
    },
    remove() { events.push("remove"); },
    setAttribute() {}
  };
  const document = {
    createElement(tag) { events.push(`create:${tag}`); return anchor; },
    body: { appendChild(node) { events.push(node === anchor ? "append" : "append?"); } }
  };
  let counter = 0;
  const URLApi = {
    createObjectURL(blob) { counter += 1; events.push(`url:${blob.size}`); return `blob:mock/${counter}`; },
    revokeObjectURL(url) { events.push(`revoke:${url}`); }
  };
  return { document, URL: URLApi, anchor, events };
}

const pdfBlob = () => new Blob(["%PDF-1.4 mock"], { type: "application/pdf" });

test("the invoice is fetched from the order's own PDF path with the store transport", async () => {
  const browser = fakeBrowser();
  const paths = [];
  await downloadInvoice({
    orderId: 12,
    fetchBlob: async (path) => { paths.push(path); return { blob: pdfBlob(), filename: "INV-12.pdf" }; },
    document: browser.document,
    URL: browser.URL,
    defer: (run) => run()
  });
  assert.deepEqual(paths, ["/store/orders/12/invoice.pdf"]);
});

test("the Blob is handed to the browser as a download with the server's filename", async () => {
  const browser = fakeBrowser();
  const result = await downloadInvoice({
    orderId: 12,
    fetchBlob: async () => ({ blob: pdfBlob(), filename: "INV-2026-12.pdf" }),
    document: browser.document,
    URL: browser.URL,
    defer: (run) => run()
  });
  assert.equal(browser.anchor.download, "INV-2026-12.pdf");
  assert.equal(browser.anchor.href, "blob:mock/1");
  assert.equal(result.filename, "INV-2026-12.pdf");
  assert.deepEqual(browser.events.slice(0, 5), ["url:13", "create:a", "append", "click", "remove"]);
});

test("with only the placeholder name from the transport, the invoice is named by its order", async () => {
  const browser = fakeBrowser();
  await downloadInvoice({
    orderId: 31,
    fetchBlob: async () => ({ blob: pdfBlob(), filename: "download" }),
    document: browser.document,
    URL: browser.URL,
    defer: (run) => run()
  });
  assert.equal(browser.anchor.download, "invoice-31.pdf");
});

test("the object URL is revoked after the click, not before it", async () => {
  const browser = fakeBrowser();
  const deferred = [];
  await downloadInvoice({
    orderId: 12,
    fetchBlob: async () => ({ blob: pdfBlob(), filename: "a.pdf" }),
    document: browser.document,
    URL: browser.URL,
    defer: (run) => deferred.push(run)
  });
  assert.equal(browser.events.some((e) => e.startsWith("revoke")), false, "not revoked while the browser may still be reading it");
  assert.equal(deferred.length, 1);
  deferred[0]();
  assert.equal(browser.events.at(-1), "revoke:blob:mock/1");
});

test("the object URL is revoked even when the browser refuses the click", async () => {
  const browser = fakeBrowser({ clickThrows: true });
  const deferred = [];
  await assert.rejects(
    downloadInvoice({
      orderId: 12,
      fetchBlob: async () => ({ blob: pdfBlob(), filename: "a.pdf" }),
      document: browser.document,
      URL: browser.URL,
      defer: (run) => deferred.push(run)
    }),
    /click blocked/
  );
  assert.ok(browser.events.includes("revoke:blob:mock/1"), "revoked straight away on a failed click");
  assert.ok(browser.events.includes("remove"), "the temporary link does not stay in the page");
});

test("a failed request creates no URL and touches no page element", async () => {
  const browser = fakeBrowser();
  await assert.rejects(
    downloadInvoice({
      orderId: 12,
      fetchBlob: async () => { throw Object.assign(new Error("Network error"), { reason: "network" }); },
      document: browser.document,
      URL: browser.URL,
      defer: (run) => run()
    }),
    /Network error/
  );
  assert.deepEqual(browser.events, []);
});

test("an empty or non-PDF answer is a failure, not a download of nothing", async () => {
  for (const blob of [new Blob([], { type: "application/pdf" }), new Blob(['{"detail":"x"}'], { type: "application/json" }), new Blob(["<html>"], { type: "text/html" })]) {
    const browser = fakeBrowser();
    await assert.rejects(
      downloadInvoice({
        orderId: 12,
        fetchBlob: async () => ({ blob, filename: "a.pdf" }),
        document: browser.document,
        URL: browser.URL,
        defer: (run) => run()
      }),
      (error) => error.reason === "not-a-pdf"
    );
    assert.deepEqual(browser.events, [], "no URL, no link");
  }
});

test("a PDF served without a content type is still accepted", async () => {
  const browser = fakeBrowser();
  await downloadInvoice({
    orderId: 12,
    fetchBlob: async () => ({ blob: new Blob(["%PDF-1.4"]), filename: "a.pdf" }),
    document: browser.document,
    URL: browser.URL,
    defer: (run) => run()
  });
  assert.ok(browser.events.includes("click"));
});

test("something that is not a Blob at all is a failure", async () => {
  const browser = fakeBrowser();
  await assert.rejects(
    downloadInvoice({ orderId: 12, fetchBlob: async () => ({ blob: "text", filename: "a.pdf" }), document: browser.document, URL: browser.URL, defer: (run) => run() }),
    (error) => error.reason === "not-a-pdf"
  );
});

test("a failed invoice is worded locally; a stale or ended session is not", () => {
  const failed = describeInvoiceError({ status: 500 });
  assert.equal(failed.kind, "failed");
  assert.equal(failed.message, "We couldn't download your invoice. Please try again.");
  assert.equal(describeInvoiceError({ status: 404 }).kind, "failed", "even a 404 stays on the order and offers Retry");
  assert.equal(describeInvoiceError({ reason: "network" }).kind, "failed");
  assert.equal(describeInvoiceError({ reason: "not-a-pdf" }).kind, "failed");
  assert.equal(describeInvoiceError({ reason: "stale" }).kind, "stale");
  assert.equal(describeInvoiceError({ status: 401, reason: "session-expired" }).kind, "signed-out");
});
