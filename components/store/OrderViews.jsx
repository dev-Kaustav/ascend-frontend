"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import ProductImage from "@/components/store/ProductImage";
import { useRetailer } from "@/components/store/RetailerProvider";
import { formatCurrency } from "@/lib/format";
import { storeEndpoints, storeFetch } from "@/lib/store/api.mjs";
import { reorderSkipText } from "@/lib/store/cart.mjs";
import { createRequestGate } from "@/lib/store/catalogue.mjs";
import {
  describeInvoiceError,
  describeOrderError,
  downloadInvoice,
  formatOrderDate,
  formatShipTo,
  invoiceNote,
  normalizeOrderDetail,
  normalizeOrderList,
  orderHref,
  orderListPath,
  orderReference,
  packetsLabel,
  productCountLabel,
  shouldRefreshOnFocus,
  statusLabel,
  statusProgress,
  totalOrderPages
} from "@/lib/store/orders.mjs";
import { getSessionGeneration } from "@/lib/store/session.mjs";

// The retailer's own orders: a paginated history and a durable detail page (also where a confirmed
// order lands, with ?placed=1). Everything here is read from the store endpoints under the
// retailer's bearer; the backend answers 404 for an order that is not theirs, and that is shown as
// "not available" without saying which. No staff controls: no status changes, drivers or maps (D-16).

// ---- one private read, bound to one identity -----------------------------------------------------------
// The answer is kept only for the (session generation, retailer, path) it was asked under, so the
// previous account's orders are never shown for a frame after a sign-out or an account switch. A
// refresh keeps the old answer on screen until the new one arrives; a failed refresh keeps it too and
// says so, so a request error is never mistaken for "no orders".
function useOwnRequest({ owner, generation, path, normalize, subject }) {
  const key = owner ? `${owner}|${path}` : null;
  const [refreshKey, setRefreshKey] = useState(0);
  const [record, setRecord] = useState(null); // { key, token, data, error }
  const lastAt = useRef(null);
  const token = `${key}#${refreshKey}`;

  useEffect(() => {
    if (!key) return undefined;
    const gate = createRequestGate();
    const mine = gate.begin();
    lastAt.current = Date.now();
    storeFetch(path)
      .then((payload) => {
        if (!gate.isCurrent(mine) || getSessionGeneration() !== generation) return;
        const data = normalize(payload);
        if (data) {
          setRecord({ key, token, data, error: null });
        } else {
          setRecord((previous) => ({
            key,
            token,
            data: previous?.key === key ? previous.data : null,
            error: describeOrderError({ status: 502 }, subject)
          }));
        }
      })
      .catch((error) => {
        if (!gate.isCurrent(mine) || getSessionGeneration() !== generation) return;
        const described = describeOrderError(error, subject);
        if (described.kind === "stale") return;
        setRecord((previous) => ({
          key,
          token,
          data: described.kind === "unavailable" ? null : previous?.key === key ? previous.data : null,
          error: described
        }));
      });
    return () => gate.invalidate();
    // token already folds key and refreshKey in; path, generation and normalize are fixed per key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((count) => count + 1), []);

  // Coming back to the tab shows the order's real state now, not as it was when the tab was left.
  useEffect(() => {
    if (!key) return undefined;
    const onReturn = () => {
      if (document.visibilityState === "hidden") return;
      if (shouldRefreshOnFocus({ lastAt: lastAt.current, now: Date.now() })) refresh();
    };
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [key, refresh]);

  const current = record && record.key === key ? record : null;
  return {
    loading: key !== null && current === null,
    data: current?.data ?? null,
    error: current?.error ?? null,
    refreshing: current !== null && current.token !== token,
    refresh
  };
}

// ---- who may see this ------------------------------------------------------------------------------------
// Anonymous visitors get the retailer sign-in (never the staff /login) with this page held as the
// destination, so they land back here after the code is verified. Nothing about an order is
// requested until a ready retailer is on screen.
function OrdersGate({ titleId, title, children }) {
  const { readiness, status, requireRetailer, refreshMe, openSheet } = useRetailer();
  const asked = useRef(false);

  const here = () => `${window.location.pathname}${window.location.search}`;

  useEffect(() => {
    if (readiness !== "anonymous" || asked.current) return;
    asked.current = true;
    requireRetailer({ type: "navigate", href: here() });
  }, [readiness, requireRetailer]);

  if (readiness === "loading") {
    return (
      <section className="store-state" aria-busy="true" aria-labelledby={titleId}>
        <h1 id={titleId}>{title}</h1>
        <p role="status">Loading your account</p>
      </section>
    );
  }
  if (readiness === "anonymous") {
    return (
      <section className="store-state" aria-labelledby={titleId}>
        <h1 id={titleId}>{title}</h1>
        <p>{status === "expired" ? "Your session ended. Log in again to see your orders." : "Log in to see your orders."}</p>
        <button type="button" className="store-button" onClick={() => requireRetailer({ type: "navigate", href: here() })}>
          Log in or Sign up
        </button>
      </section>
    );
  }
  if (readiness === "error") {
    return (
      <section className="store-state" aria-labelledby={titleId}>
        <h1 id={titleId}>{title}</h1>
        <p role="alert">We couldn&apos;t load your account.</p>
        <button type="button" className="store-button" onClick={refreshMe}>
          Try again
        </button>
      </section>
    );
  }
  if (readiness !== "ready") {
    return (
      <section className="store-state" aria-labelledby={titleId}>
        <h1 id={titleId}>{title}</h1>
        <p>Finish setting up your shop to see your orders.</p>
        <button type="button" className="store-button" onClick={() => openSheet("shop")}>
          Set up your shop
        </button>
      </section>
    );
  }
  return children;
}

function StatusChip({ status }) {
  return (
    <span className="store-status" data-status={statusLabel(status) === "Status unavailable" ? "UNKNOWN" : status}>
      {statusLabel(status)}
    </span>
  );
}

function RefreshButton({ onClick, busy, label }) {
  return (
    <button type="button" className="store-link-button" onClick={onClick} disabled={busy} aria-label={label}>
      {busy ? "Refreshing" : "Refresh"}
    </button>
  );
}

// ---- reorder ---------------------------------------------------------------------------------------------
// Reorder reads the order and today's products, merges them into the cart already on screen and opens the
// cart for review (RetailerProvider.reorder). It is a button of its own, never part of the link to the
// order, and it never places anything: the retailer still reviews the cart and presses Place order.

function ReorderButton({ orderId, lines, className = "store-button store-button--secondary" }) {
  const { reorder } = useRetailer();
  const working = reorder?.view?.phase === "working";
  const mine = working && reorder.view.orderId === orderId;
  return (
    <button
      type="button"
      className={className}
      disabled={!reorder || working}
      aria-label={`Reorder ${orderReference(orderId)}`}
      onClick={() => reorder.run({ orderId, lines })}
    >
      {mine ? "Adding to cart" : "Reorder"}
    </button>
  );
}

/** The named products a reorder skipped or lowered. Used on the order pages and in the cart review. */
export function ReorderSummary({ view }) {
  if (!view || (view.skipped.length === 0 && view.reduced.length === 0)) return null;
  return (
    <ul className="store-reorder__list">
      {view.skipped.map((item) => (
        <li key={`s${item.sku_id}`}>
          {item.name}: {reorderSkipText(item.reason)}
        </li>
      ))}
      {view.reduced.map((item) => (
        <li key={`r${item.sku_id}`}>
          {item.name}: only {item.quantity} available, you asked for {item.wanted}
        </li>
      ))}
    </ul>
  );
}

// What a reorder says when it did not open the cart: nothing could be added (the cart is as it was), or it
// could not be checked. The success path is told in the cart, where the review happens.
function ReorderNotice({ lines }) {
  const { reorder } = useRetailer();
  const view = reorder?.view;
  if (!view || (view.phase !== "none" && view.phase !== "failed")) return null;
  const detail = view.view;
  return (
    <div className="store-reorder store-order-notice" role={view.phase === "failed" ? "alert" : "status"} data-reorder={view.phase}>
      <p>{detail.message}</p>
      <ReorderSummary view={detail} />
      <div className="store-reorder__actions">
        {detail.retry ? (
          <button type="button" className="store-link-button" onClick={() => reorder.run({ orderId: view.orderId, lines })}>
            Try again
          </button>
        ) : null}
        <button type="button" className="store-link-button" onClick={reorder.dismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ---- history ---------------------------------------------------------------------------------------------

function OrderRow({ order }) {
  const products = productCountLabel(order.item_count);
  const date = formatOrderDate(order.created_at);
  return (
    <li className="store-order-card" data-order-id={order.id} data-status={order.status}>
      <Link href={orderHref(order.id)} className="store-order-card__link">
        <span className="store-order-card__top">
          <span className="store-order-card__ref">{orderReference(order.id)}</span>
          <StatusChip status={order.status} />
        </span>
        <span className="store-order-card__meta">{[date, products].filter(Boolean).join(" · ")}</span>
        <span className="store-order-card__total">{order.total === null ? "" : formatCurrency(order.total)}</span>
      </Link>
      <div className="store-order-card__actions">
        <ReorderButton orderId={order.id} />
      </div>
    </li>
  );
}

function HistorySkeleton() {
  return (
    <ul className="store-order-list" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <li key={index} className="store-order-card store-order-card--skeleton">
          <span className="store-skeleton-bar store-skeleton-bar--short" />
          <span className="store-skeleton-bar" />
          <span className="store-skeleton-bar store-skeleton-bar--short" />
        </li>
      ))}
    </ul>
  );
}

function History({ page }) {
  const { generation, retailerId } = useRetailer();
  const request = useOwnRequest({
    owner: `${generation}:${retailerId}`,
    generation,
    path: orderListPath(page),
    normalize: normalizeOrderList,
    subject: "orders"
  });
  const { data, error } = request;
  const pages = data ? totalOrderPages(data.total) : 0;

  return (
    <section className="store-orders" aria-labelledby="store-orders-title" aria-busy={request.loading || request.refreshing ? "true" : undefined}>
      <div className="store-orders__head">
        <h1 id="store-orders-title">Your orders</h1>
        {data ? <RefreshButton onClick={request.refresh} busy={request.refreshing} label="Refresh orders" /> : null}
      </div>

      {request.loading ? (
        <>
          <p className="sr-only" role="status">
            Loading your orders
          </p>
          <HistorySkeleton />
        </>
      ) : null}

      {!request.loading && !data && error ? (
        <div className="store-state">
          <p role="alert">{error.message}</p>
          {error.kind === "failed" ? (
            <button type="button" className="store-button" onClick={request.refresh}>
              Try again
            </button>
          ) : null}
        </div>
      ) : null}

      <ReorderNotice />

      {data && error && error.kind === "failed" ? (
        <div className="store-order-notice" role="alert">
          <p>We couldn&apos;t refresh your orders.</p>
          <button type="button" className="store-link-button" onClick={request.refresh}>
            Try again
          </button>
        </div>
      ) : null}

      {data && data.total === 0 ? (
        <div className="store-state">
          <h2>No orders yet</h2>
          <p>Your orders will appear here after checkout.</p>
          <Link href="/products" className="store-button">
            Browse products
          </Link>
        </div>
      ) : null}

      {data && data.total > 0 && data.items.length === 0 ? (
        <div className="store-state">
          <h2>No orders on this page</h2>
          <p>
            You have {data.total === 1 ? "1 order" : `${data.total} orders`}, on {pages === 1 ? "page 1" : `pages 1 to ${pages}`}.
          </p>
          <Link href="/orders" className="store-button">
            Show newest orders
          </Link>
        </div>
      ) : null}

      {data && data.items.length > 0 ? (
        <>
          <p className="store-results__count" role="status">
            {data.total === 1 ? "1 order" : `${data.total} orders`}
          </p>
          <ul className="store-order-list">
            {data.items.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </ul>
        </>
      ) : null}

      {pages > 1 && data?.items.length > 0 ? (
        <nav className="store-pager" aria-label="Pages">
          {page > 1 ? (
            <Link href={page - 1 === 1 ? "/orders" : `/orders?page=${page - 1}`} rel="prev">
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span>
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={`/orders?page=${page + 1}`} rel="next">
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </section>
  );
}

export function OrderHistory({ page = 1 }) {
  return (
    <OrdersGate titleId="store-orders-title" title="Your orders">
      <History page={page} />
    </OrdersGate>
  );
}

// ---- detail ----------------------------------------------------------------------------------------------

function ProgressSteps({ status }) {
  const progress = statusProgress(status);
  if (progress.interrupted) {
    return (
      <p className="store-order-interrupt" role="status" data-status={progress.interrupted.status}>
        This order was {progress.interrupted.label.toLowerCase()}.
      </p>
    );
  }
  if (progress.stages.length === 0) {
    return (
      <p className="store-order-interrupt" role="status">
        {statusLabel(status)}
      </p>
    );
  }
  return (
    <ol className="store-steps" aria-label="Order progress">
      {progress.stages.map((stage) => (
        <li key={stage.status} data-state={stage.state} aria-current={stage.state === "current" ? "step" : undefined}>
          <span className="store-steps__mark" aria-hidden="true" />
          <span>
            {stage.label}
            {stage.state === "done" ? <span className="sr-only"> (completed)</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

function ShipTo({ shipTo }) {
  const { label, lines } = formatShipTo(shipTo);
  return (
    <div className="store-order-block" aria-labelledby="store-order-shipto">
      <h2 id="store-order-shipto">Ship to</h2>
      {label || lines.length > 0 ? (
        <>
          {label ? <p className="store-account__name">{label}</p> : null}
          <div className="store-account__lines">
            {lines.map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </div>
        </>
      ) : (
        <p>No delivery address was recorded for this order.</p>
      )}
    </div>
  );
}

function Lines({ lines }) {
  return (
    <ul className="store-order-lines">
      {lines.map((line) => (
        <li key={line.sku_id} className="store-order-line" data-sku-id={line.sku_id}>
          <div className="store-cart__thumb">
            <ProductImage src={line.image_url} lazy />
          </div>
          <div className="store-order-line__info">
            <p className="store-cart__name">{line.name ?? "Product no longer listed"}</p>
            {line.pack_size ? <p className="store-cart__pack">{line.pack_size}</p> : null}
            <p className="store-cart__pack">{packetsLabel(line.quantity)}</p>
          </div>
          <p className="store-order-line__total">{line.line_total === null ? "" : formatCurrency(line.line_total)}</p>
        </li>
      ))}
    </ul>
  );
}

function Totals({ order }) {
  return (
    <dl className="store-cart__totals store-order-totals">
      {order.subtotal !== null ? (
        <div>
          <dt>Subtotal</dt>
          <dd>{formatCurrency(order.subtotal)}</dd>
        </div>
      ) : null}
      {order.delivery_charge !== null ? (
        <div>
          <dt>Delivery</dt>
          <dd>{order.delivery_charge === 0 ? "Free" : formatCurrency(order.delivery_charge)}</dd>
        </div>
      ) : null}
      <div className="store-cart__grand">
        <dt>Total</dt>
        <dd>{order.total === null ? "" : formatCurrency(order.total)}</dd>
      </div>
    </dl>
  );
}

// The issued invoice. Offered only when the server says one exists; before dispatch the page says
// when to expect it. A failed download stays on this page with its own Retry and never replaces the
// order. One download at a time: the guard is a ref (synchronous), so a double tap cannot start two.
// What a download left behind belongs to the identity it ran under and is dropped with it.
function InvoiceSection({ order, owner }) {
  const note = invoiceNote(order);
  const [record, setRecord] = useState(null); // { owner, busy, failure }
  const running = useRef(false);
  const mine = record && record.owner === owner ? record : null;

  const start = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setRecord({ owner, busy: true, failure: null });
    try {
      await downloadInvoice({ orderId: order.id });
      setRecord({ owner, busy: false, failure: null });
    } catch (error) {
      const described = describeInvoiceError(error);
      setRecord(described.kind === "stale" ? null : { owner, busy: false, failure: described });
    } finally {
      running.current = false;
    }
  }, [owner, order.id]);

  if (note.kind === "none") return null;
  return (
    <div className="store-order-block" aria-labelledby="store-order-invoice">
      <h2 id="store-order-invoice">Invoice</h2>
      {note.kind === "pending" ? <p>{note.text}</p> : null}
      {note.kind === "download" ? (
        <div className="store-state__actions">
          {mine?.failure?.kind === "failed" ? (
            <button type="button" className="store-button" onClick={start} disabled={mine.busy} aria-label="Retry invoice download">
              {mine.busy ? "Downloading" : "Retry"}
            </button>
          ) : (
            <button type="button" className="store-button" onClick={start} disabled={mine?.busy === true} aria-label={`Download invoice for ${orderReference(order.id)}`}>
              {mine?.busy ? "Downloading" : "Download invoice"}
            </button>
          )}
        </div>
      ) : null}
      {mine?.failure ? (
        <p className="store-form-error" role="alert">
          {mine.failure.message}
        </p>
      ) : null}
    </div>
  );
}

function Confirmation({ order }) {
  const { lines } = formatShipTo(order.ship_to);
  return (
    <section className="store-order-placed" aria-labelledby="store-order-placed-title" data-order-placed="true">
      <h1 id="store-order-placed-title">Order placed</h1>
      <p className="store-order-placed__ref">{orderReference(order.id)}</p>
      <dl className="store-order-placed__facts">
        <div>
          <dt>Amount payable</dt>
          <dd>{order.total === null ? "" : formatCurrency(order.total)}</dd>
        </div>
        <div>
          <dt>Pay on delivery</dt>
          <dd>Cash or UPI</dd>
        </div>
        {lines.length > 0 ? (
          <div>
            <dt>Delivering to</dt>
            <dd>
              {lines.map((line, index) => (
                <span key={index} className="store-order-placed__line">
                  {line}
                </span>
              ))}
            </dd>
          </div>
        ) : null}
      </dl>
      <div className="store-state__actions">
        <Link href={orderHref(order.id)} className="store-button" replace>
          View order
        </Link>
        <Link href="/" className="store-link-button">
          Continue shopping
        </Link>
      </div>
    </section>
  );
}

function Unavailable({ message }) {
  return (
    <section className="store-state" aria-labelledby="store-order-title">
      <h1 id="store-order-title">Order not available</h1>
      <p role="status">{message}</p>
      <Link href="/orders" className="store-button">
        View my orders
      </Link>
    </section>
  );
}

function Detail({ id, placed }) {
  const { generation, retailerId } = useRetailer();
  const request = useOwnRequest({
    owner: `${generation}:${retailerId}`,
    generation,
    path: storeEndpoints.order(id),
    normalize: normalizeOrderDetail,
    subject: "order"
  });
  const { data: order, error } = request;

  if (request.loading) {
    return (
      <section className="store-orders" aria-busy="true" aria-labelledby="store-order-title">
        <h1 id="store-order-title">{orderReference(id)}</h1>
        <p className="sr-only" role="status">
          Loading your order
        </p>
        <HistorySkeleton />
      </section>
    );
  }
  if (!order && error?.kind === "unavailable") return <Unavailable message={error.message} />;
  if (!order) {
    return (
      <section className="store-state" aria-labelledby="store-order-title">
        <h1 id="store-order-title">{orderReference(id)}</h1>
        <p role="alert">{error?.message ?? "We couldn't load your order. Please try again."}</p>
        <button type="button" className="store-button" onClick={request.refresh}>
          Try again
        </button>
      </section>
    );
  }

  // The confirmation is the order itself read back from the server, and only while it is still a
  // freshly placed one; anything later is just the order.
  if (placed && order.status === "PENDING") return <Confirmation order={order} />;

  const date = formatOrderDate(order.created_at);
  return (
    <section className="store-orders store-order" aria-labelledby="store-order-title" aria-busy={request.refreshing ? "true" : undefined} data-order-id={order.id}>
      <p className="store-order__back">
        <Link href="/orders">All orders</Link>
      </p>
      <div className="store-orders__head">
        <div className="store-order__title">
          <h1 id="store-order-title">{orderReference(order.id)}</h1>
          {date ? <p className="store-hint">Placed {date}</p> : null}
        </div>
        <RefreshButton onClick={request.refresh} busy={request.refreshing} label="Refresh order" />
      </div>

      {error && error.kind === "failed" ? (
        <div className="store-order-notice" role="alert">
          <p>We couldn&apos;t refresh this order.</p>
          <button type="button" className="store-link-button" onClick={request.refresh}>
            Try again
          </button>
        </div>
      ) : null}

      <div className="store-order-block" aria-labelledby="store-order-status">
        <h2 id="store-order-status">Status</h2>
        <p className="store-order-block__status">
          <StatusChip status={order.status} />
        </p>
        <ProgressSteps status={order.status} />
        {order.lines.length > 0 ? (
          <div className="store-order-block__actions">
            <ReorderButton orderId={order.id} lines={order.lines.map(({ sku_id, quantity, name }) => ({ sku_id, quantity, name }))} />
          </div>
        ) : null}
      </div>

      <ReorderNotice lines={order.lines.map(({ sku_id, quantity, name }) => ({ sku_id, quantity, name }))} />

      <div className="store-order-block" aria-labelledby="store-order-items">
        <h2 id="store-order-items">Items</h2>
        {order.lines.length > 0 ? <Lines lines={order.lines} /> : <p>No items to show.</p>}
        <Totals order={order} />
        <p className="store-hint">Pay on delivery: cash or UPI</p>
      </div>

      <InvoiceSection order={order} owner={`${generation}:${retailerId}`} />

      <ShipTo shipTo={order.ship_to} />
    </section>
  );
}

export function OrderDetail({ id, placed = false }) {
  // A route id that is not a plain order number never reaches the network or the sign-in.
  if (id === null || id === undefined) return <Unavailable message="This order isn't available." />;
  return (
    <OrdersGate titleId="store-order-title" title={orderReference(id)}>
      <Detail key={id} id={id} placed={placed} />
    </OrdersGate>
  );
}
