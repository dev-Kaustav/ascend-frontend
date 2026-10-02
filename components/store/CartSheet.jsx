"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import ProductImage from "@/components/store/ProductImage";
import { useRetailer } from "@/components/store/RetailerProvider";
import SheetFrame from "@/components/store/SheetFrame";
import { formatCurrency } from "@/lib/format";
import { historyEntry } from "@/lib/store/sheet-history";

// The cart review. Every name, image and rupee here is the server's quote for the cart as it is now;
// the cart itself holds only SKU ids and packets (lib/store/cart.mjs). While the quote is being
// refreshed, or when it failed, no total is shown, so a stale price is never read as current.

function BrowseLink({ onClose }) {
  const router = useRouter();
  return (
    <Link
      href="/products"
      className="store-button"
      onClick={(event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        // The sheet's history entry is replaced by the destination, so Back returns to the page the
        // cart was opened from (the same hand-over the login sheet uses).
        historyEntry.open = false;
        router.replace("/products");
        onClose();
      }}
    >
      Browse products
    </Link>
  );
}

export default function CartSheet({ onClose }) {
  const { cart } = useRetailer();
  const readiness = cart?.readiness;
  const quote = readiness?.quote ?? null;
  const priced = new Map((quote?.lines ?? []).map((line) => [line.sku_id, line]));

  return (
    <SheetFrame title="Your cart" titleId="store-cart-title" closeLabel="Close cart" onDismiss={onClose} className="store-sheet--cart">
      {!cart ? (
        <p className="store-hint" role="status">
          Loading your cart
        </p>
      ) : cart.lines.length === 0 ? (
        <div className="store-state store-cart__empty">
          <h3>Your cart is empty</h3>
          <p>Add snacks to get started.</p>
          <BrowseLink onClose={onClose} />
        </div>
      ) : (
        <>
          <ul className="store-cart__lines">
            {cart.lines.map((line) => {
              const shown = priced.get(line.sku_id) ?? cart.known[line.sku_id] ?? null;
              return (
                <li key={line.sku_id} className="store-cart__line" data-sku-id={line.sku_id}>
                  <div className="store-cart__thumb">
                    <ProductImage src={shown?.image_url} lazy />
                  </div>
                  <div className="store-cart__info">
                    <p className="store-cart__name">{shown?.name ?? "Loading product"}</p>
                    {shown?.pack_size ? <p className="store-cart__pack">{shown.pack_size}</p> : null}
                    <p className="store-cart__qty">Packets: {line.quantity}</p>
                  </div>
                  <p className="store-cart__total">{priced.has(line.sku_id) ? formatCurrency(priced.get(line.sku_id).line_total) : ""}</p>
                </li>
              );
            })}
          </ul>

          <div className="store-cart__summary" role="status" aria-live="polite">
            {readiness.state === "updating" ? <p>Updating your total</p> : null}
            {readiness.state === "error" ? (
              <>
                <p className="store-form-error">We couldn&apos;t update your total. Try again before placing your order.</p>
                <button type="button" className="store-button store-button--secondary" onClick={cart.retryQuote}>
                  Try again
                </button>
              </>
            ) : null}
            {quote ? (
              <dl className="store-cart__totals">
                <div>
                  <dt>Subtotal</dt>
                  <dd>{formatCurrency(quote.subtotal)}</dd>
                </div>
                <div>
                  <dt>Delivery</dt>
                  <dd>{quote.delivery_charge > 0 ? formatCurrency(quote.delivery_charge) : "Free"}</dd>
                </div>
                <div className="store-cart__grand">
                  <dt>Total</dt>
                  <dd>{formatCurrency(quote.total)}</dd>
                </div>
              </dl>
            ) : null}
          </div>
        </>
      )}
    </SheetFrame>
  );
}
