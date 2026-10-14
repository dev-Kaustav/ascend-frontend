"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRetailer } from "@/components/store/RetailerProvider";
import { formatCurrency } from "@/lib/format";
import { PLACEMENT_COPY } from "@/lib/store/api.mjs";
import { formatAddressLines, headerAddressLabel } from "@/lib/store/maps.mjs";
import { formatOrderDate, orderHref, orderReference, statusLabel } from "@/lib/store/orders.mjs";
import { historyEntry } from "@/lib/store/sheet-history";

// Checkout lives inside the cart's fixed footer (D-13): the chosen saved address with Change, Pay on
// delivery: cash or UPI, and the one Place order. The rupees above it are the server's quote and the
// button stays off until that quote is current, every line is in stock and the address is one the
// server lists (checkoutGate). Nothing here prices anything or decides what an order is.
//
// Three outcomes are kept apart (D-15): confirmed (a 201 with an order id: the person is taken to the
// durable order page), refused (the server said no: the cart is kept and the reason is given), and
// unconfirmed (the answer was lost: nothing is claimed, the cart is kept, and Place order stays off
// until the person has looked at My orders).

// A link out of the cart sheet: the sheet's history entry is replaced by the destination, so Back
// returns to the page the cart was opened from (the same hand-over as Browse products).
function SheetLink({ href, className, children }) {
  const router = useRouter();
  const { closeSheet } = useRetailer();
  return (
    <Link
      href={href}
      className={className}
      onClick={(event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        historyEntry.open = false;
        router.replace(href);
        closeSheet();
      }}
    >
      {children}
    </Link>
  );
}

function orderLine(order) {
  const date = formatOrderDate(order.created_at);
  return [orderReference(order.id), date, order.total === null ? null : formatCurrency(order.total), statusLabel(order.status)].filter(Boolean).join(" · ");
}

// The answer was lost. The person looks at their own newest orders before anything can be sent again.
function Unconfirmed({ checkout }) {
  const check = checkout.view.check;
  const loading = check?.phase === "loading";
  return (
    <div className="store-checkout__uncertain" role="alert">
      <p>{PLACEMENT_COPY.uncertain}</p>
      {check?.phase === "ready" ? (
        <>
          {check.orders.length > 0 ? (
            <ul className="store-checkout__recent" aria-label="Your newest orders">
              {check.orders.map((order) => (
                <li key={order.id}>
                  <SheetLink href={orderHref(order.id)} className="store-link-button">
                    {orderLine(order)}
                  </SheetLink>
                </li>
              ))}
            </ul>
          ) : (
            <p>You have no orders yet.</p>
          )}
          <p className="store-checkout__advice">If your order is listed, don&apos;t place it again.</p>
          <div className="store-checkout__choices">
            <button type="button" className="store-button" onClick={checkout.emptyCartAfterCheck}>
              My order is there: empty my cart
            </button>
            <button type="button" className="store-button store-button--secondary" onClick={checkout.resolveUncertain}>
              It isn&apos;t there: let me place it again
            </button>
          </div>
        </>
      ) : (
        <>
          {check?.phase === "error" ? <p className="store-form-error">We couldn&apos;t load your orders. Try again.</p> : null}
          <div className="store-checkout__choices">
            <button type="button" className="store-button store-button--secondary" onClick={checkout.checkOrders} disabled={loading} aria-busy={loading ? "true" : undefined}>
              {loading ? "Checking your orders" : check?.phase === "error" ? "Try again" : "Check My orders"}
            </button>
            <SheetLink href="/orders" className="store-link-button">
              Open My orders
            </SheetLink>
          </div>
        </>
      )}
    </div>
  );
}

export default function Checkout() {
  const { cart, checkout, selectedAddress, openAddresses, requireRetailer } = useRetailer();
  const outcomeRef = useRef(null);
  const phase = checkout?.view.phase ?? "idle";
  const checkPhase = checkout?.view.check?.phase ?? null;

  // A message that appears under a footer that scrolls on its own is brought into view, so the
  // outcome is never hidden below the fold of a short phone screen.
  useEffect(() => {
    if (phase === "refused" || phase === "uncertain") outcomeRef.current?.scrollIntoView({ block: "nearest" });
  }, [phase, checkPhase]);

  if (!cart || !checkout) return null;
  const { view, gate, placeOrder } = checkout;
  const submitting = view.phase === "submitting";
  const chooseAddress = () => openAddresses({ returnTo: "cart" });
  const rest = selectedAddress ? formatAddressLines(selectedAddress).slice(1).join(", ") : "";
  const unavailable = view.phase === "refused" && view.problem?.kind === "unavailable";

  // A guest cart: login (and the shop, if it is not set up yet) is asked for here and nowhere earlier.
  // Afterwards the cart opens again with the same lines, and Place order is pressed on purpose.
  if (gate.reason === "signed-out") {
    return (
      <div className="store-checkout" data-checkout-phase="guest">
        <button type="button" className="store-button store-checkout__place" onClick={() => requireRetailer({ type: "cart" })}>
          Log in to place order
        </button>
      </div>
    );
  }

  return (
    <div className="store-checkout" data-checkout-phase={view.phase}>
      <div className="store-checkout__address">
        {selectedAddress ? (
          <>
            <div className="store-checkout__where">
              <p className="store-checkout__label">Deliver to</p>
              <p className="store-checkout__name">{headerAddressLabel(selectedAddress)}</p>
              {rest ? <p className="store-checkout__rest">{rest}</p> : null}
            </div>
            <button type="button" className="store-link-button" onClick={chooseAddress} aria-label="Change delivery address">
              Change
            </button>
          </>
        ) : (
          <>
            <p className="store-checkout__hint">{gate.reason === "no-address" ? "Add a delivery address to place your order." : "Choose where to deliver."}</p>
            <button type="button" className="store-button store-button--secondary" onClick={chooseAddress}>
              {gate.reason === "no-address" ? "Add delivery address" : "Choose address"}
            </button>
          </>
        )}
      </div>

      <p className="store-checkout__payment">Pay on delivery: cash or UPI</p>

      <div ref={outcomeRef}>
        {view.phase === "refused" ? (
          <div className="store-checkout__refused">
            <p className="store-form-error" role="alert">
              {view.problem?.message}
            </p>
            {unavailable ? (
              <button
                type="button"
                className="store-button store-button--secondary"
                onClick={() => {
                  cart.removeLines(view.problem.skuIds);
                  checkout.dismiss();
                }}
              >
                Remove unavailable items
              </button>
            ) : null}
          </div>
        ) : null}
        {view.phase === "stock-review" ? <p className="store-hint">Review the changes to your cart above, then place your order again.</p> : null}
        {view.phase === "uncertain" ? <Unconfirmed checkout={checkout} /> : null}
        {view.phase === "confirmed" && view.order ? (
          <p className="store-checkout__placed" role="status">
            Order placed. {orderReference(view.order.id)}.{" "}
            <SheetLink href={`${orderHref(view.order.id)}?placed=1`} className="store-link-button">
              View order
            </SheetLink>
          </p>
        ) : null}
      </div>

      <button
        type="button"
        className="store-button store-checkout__place"
        disabled={!gate.canPlace}
        aria-busy={submitting ? "true" : undefined}
        onClick={() => placeOrder()}
      >
        {submitting ? "Placing your order" : "Place order"}
      </button>
      <p className="store-checkout__live" role="status" aria-live="polite">
        {submitting ? "Placing your order" : ""}
      </p>
    </div>
  );
}
