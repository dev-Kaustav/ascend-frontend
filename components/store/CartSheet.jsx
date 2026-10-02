"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import Checkout from "@/components/store/Checkout";
import ProductImage from "@/components/store/ProductImage";
import { useRetailer } from "@/components/store/RetailerProvider";
import SheetFrame from "@/components/store/SheetFrame";
import { formatCurrency } from "@/lib/format";
import { freeDeliveryRemaining } from "@/lib/store/cart.mjs";
import { historyEntry } from "@/lib/store/sheet-history";

// The cart review. Every name, image and rupee here is the server's quote for the cart as it is now;
// the cart itself holds only SKU ids and packets (lib/store/cart.mjs). While the quote is being
// refreshed, or when it failed, no total is shown and the order is not offered, so a stale price is
// never read as current. A shortage is shown and waits for the retailer to accept it.

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

function shortNote(stock) {
  if (!stock) return null;
  return stock.max_orderable > 0 ? `Only ${stock.max_orderable} available` : "Out of stock";
}

function CartLine({ line, cart, priced, shown, short, gone }) {
  const name = shown?.name ?? "Loading product";
  const max = Number.isInteger(shown?.max_orderable) && shown.max_orderable > 0 ? shown.max_orderable : null;
  const atMax = max !== null && line.quantity >= max;
  const unit = shown ? formatCurrency(shown.trade_price) : null;
  const note = gone ? "No longer available" : shortNote(short);
  return (
    <li className="store-cart__line" data-sku-id={line.sku_id} data-short={note ? "true" : "false"}>
      <div className="store-cart__thumb">
        <ProductImage src={shown?.image_url} lazy />
      </div>
      <div className="store-cart__info">
        <p className="store-cart__name">{name}</p>
        {shown?.pack_size ? <p className="store-cart__pack">{shown.pack_size}</p> : null}
        {unit ? <p className="store-cart__pack">{unit} per packet</p> : null}
        {note ? <p className="store-cart__note">{note}</p> : null}
      </div>
      <div className="store-cart__actions">
        <div className="store-qty-wrap">
          <div className="store-qty store-cart__stepper" role="group" aria-label={`Quantity of ${name}`}>
            <button type="button" aria-label={`Decrease quantity of ${name}`} onClick={() => cart.setQuantity(line.sku_id, line.quantity - 1)}>
              <Minus size={18} strokeWidth={2} aria-hidden="true" />
            </button>
            <output aria-live="polite" aria-label={`${name} quantity`}>
              {line.quantity}
            </output>
            <button
              type="button"
              aria-label={`Increase quantity of ${name}`}
              disabled={atMax}
              onClick={() => cart.setQuantity(line.sku_id, line.quantity + 1, max ?? undefined)}
            >
              <Plus size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
          {atMax && !short ? <p className="store-qty__max">Maximum available</p> : null}
        </div>
        <p className="store-cart__total">{priced ? formatCurrency(priced.line_total) : ""}</p>
        <button type="button" className="store-link-button store-cart__remove" aria-label={`Remove ${name}`} onClick={() => cart.removeLine(line.sku_id)}>
          Remove
        </button>
      </div>
    </li>
  );
}

function Totals({ quote }) {
  const remaining = freeDeliveryRemaining(quote);
  return (
    <>
      {remaining !== null ? <p className="store-cart__progress">Add {formatCurrency(remaining)} for free delivery</p> : null}
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
    </>
  );
}

export default function CartSheet({ onClose }) {
  const { cart } = useRetailer();
  const readiness = cart?.readiness;
  const quote = readiness?.quote ?? null;
  const priced = new Map((quote?.lines ?? []).map((line) => [line.sku_id, line]));
  const shortBySku = new Map((readiness?.stock ?? []).map((item) => [item.sku_id, item]));
  const problem = cart?.problem ?? null;
  const goneIds = new Set(problem?.kind === "unavailable" ? problem.skuIds : []);
  const empty = Boolean(cart) && cart.lines.length === 0;

  let footer = null;
  if (cart && !empty) {
    footer = (
      <div className="store-cart__footer" data-order-ready={readiness.ready ? "true" : "false"}>
        {readiness.state === "updating" ? (
          <p className="store-cart__updating" role="status">
            Updating your total
          </p>
        ) : null}
        {readiness.state === "error" ? (
          <>
            <p className="store-form-error" role="alert">
              {problem.message}
            </p>
            <div className="store-cart__problem-actions">
              {problem.kind === "unavailable" ? (
                <button type="button" className="store-button" onClick={() => cart.removeLines(problem.skuIds)}>
                  Remove unavailable items
                </button>
              ) : null}
              {problem.kind !== "unavailable" ? (
                <button type="button" className="store-button store-button--secondary" onClick={cart.retryQuote}>
                  Try again
                </button>
              ) : null}
            </div>
          </>
        ) : null}
        {quote ? <Totals quote={quote} /> : null}
        <Checkout />
      </div>
    );
  }

  return (
    <SheetFrame
      title="Your cart"
      titleId="store-cart-title"
      closeLabel="Close cart"
      onDismiss={onClose}
      className="store-sheet--cart"
      backdropClass="store-sheet-backdrop--drawer"
      footer={footer}
    >
      {!cart ? (
        <p className="store-hint" role="status">
          Loading your cart
        </p>
      ) : empty ? (
        <div className="store-state store-cart__empty">
          <h3>Your cart is empty</h3>
          <p>Add snacks to get started.</p>
          <BrowseLink onClose={onClose} />
        </div>
      ) : (
        <>
          {readiness.state === "stock" ? (
            <div className="store-cart__review" role="alert">
              <p>Availability changed. Review these items before placing your order.</p>
              <ul>
                {readiness.stock.map((item) => (
                  <li key={item.sku_id}>
                    {item.name ?? `Product ${item.sku_id}`}: {item.max_orderable > 0 ? `only ${item.max_orderable} available, you have ${item.quantity}` : "out of stock"}
                  </li>
                ))}
              </ul>
              <button type="button" className="store-button" onClick={cart.acceptStock}>
                Accept changes
              </button>
            </div>
          ) : null}
          <ul className="store-cart__lines">
            {cart.lines.map((line) => (
              <CartLine
                key={line.sku_id}
                line={line}
                cart={cart}
                priced={priced.get(line.sku_id) ?? null}
                shown={priced.get(line.sku_id) ?? cart.known[line.sku_id] ?? null}
                short={shortBySku.get(line.sku_id) ?? null}
                gone={goneIds.has(line.sku_id)}
              />
            ))}
          </ul>
        </>
      )}
    </SheetFrame>
  );
}
