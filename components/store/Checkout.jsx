"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRetailer } from "@/components/store/RetailerProvider";
import { PLACEMENT_COPY } from "@/lib/store/api.mjs";
import { formatAddressLines, headerAddressLabel } from "@/lib/store/maps.mjs";
import { historyEntry } from "@/lib/store/sheet-history";

// Checkout lives inside the cart's fixed footer (D-13): the chosen saved address with Change, Pay on
// delivery: cash or UPI, and the one Place order. The rupees above it are the server's quote and the
// button stays off until that quote is current, every line is in stock and the address is one the
// server lists (checkoutGate). Nothing here prices anything or decides what an order is.

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

export default function Checkout() {
  const { cart, checkout, selectedAddress, openAddresses } = useRetailer();
  if (!cart || !checkout) return null;
  const { view, gate, placeOrder } = checkout;
  const submitting = view.phase === "submitting";
  const chooseAddress = () => openAddresses({ returnTo: "cart" });
  const rest = selectedAddress ? formatAddressLines(selectedAddress).slice(1).join(", ") : "";

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

      {view.phase === "refused" ? (
        <p className="store-form-error" role="alert">
          {view.problem?.message}
        </p>
      ) : null}
      {view.phase === "uncertain" ? (
        <div className="store-checkout__uncertain" role="alert">
          <p>{PLACEMENT_COPY.uncertain}</p>
          <SheetLink href="/orders" className="store-button store-button--secondary">
            Check My orders
          </SheetLink>
        </div>
      ) : null}
      {view.phase === "confirmed" && view.order ? (
        <p className="store-checkout__placed" role="status">
          Order placed. Order #{view.order.id}.{" "}
          <SheetLink href={`/orders/${view.order.id}?placed=1`} className="store-link-button">
            View order
          </SheetLink>
        </p>
      ) : null}

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
