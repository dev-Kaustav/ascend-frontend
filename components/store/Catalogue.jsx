"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cookie, Minus, Nut, Package, Plus, Popcorn, Wheat } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import ProductImage from "@/components/store/ProductImage";
import { useRetailer } from "@/components/store/RetailerProvider";
import { formatCurrency } from "@/lib/format";
import { isStaleStoreError, storeEndpoints, storeFetch } from "@/lib/store/api.mjs";
import {
  DEFAULT_LISTING_LIMIT,
  clampQuantity,
  createPositionMemory,
  createRequestGate,
  createTraversalTracker,
  decideAddResume,
  displayPrice,
  listingHref,
  packOf,
  pageOffset,
  piecesLabel,
  productQuery,
  productsPath,
  purchaseState,
  sortAvailableLast,
  stepQuantity,
  totalPages,
  viewerKey
} from "@/lib/store/catalogue.mjs";

// Catalogue UI for the storefront: product cards and shelves, the searchable listing, and the
// data hooks the home and the product page share. All product text is rendered as React text
// (never as HTML) and only https images are shown (T-09-05-2).

// Identity-independent data (categories, brands) is always fetched anonymously.
export const PUBLIC_VIEWER = { mode: "public", key: "public", canPurchase: false };

/** How the current visitor is looking at the catalogue (see viewerKey). Stable between renders. */
export function useViewer() {
  const { status, readiness, generation } = useRetailer();
  return useMemo(() => viewerKey({ status, readiness, generation }), [status, readiness, generation]);
}

/**
 * One catalogue request, tied to who is asking.
 *   id:     what is being asked for (a query string); a new id is a new request.
 *   load:   (get, isCurrent) => Promise; call get(path) to fetch with the right identity
 *           (anonymous, or the ready retailer's bearer). isCurrent() turns false once the request
 *           is superseded, so a multi-page load can stop. Only the latest request may win.
 *   viewer: from useViewer(). "pending" waits for readiness; a new key (login, logout, account
 *           switch) discards the previous results at once, so nobody sees another identity's data.
 *   seed:   { id, data } from the server, public shape, used as the first result for that id.
 *   enabled: false means no request at all.
 * Returns { phase: "idle" | "loading" | "ready" | "error", data, error, busy, retry }. busy is true
 * while an earlier result for the same identity is still shown during a new request.
 */
export function useViewerResource({ id, load, viewer, seed = null, enabled = true }) {
  const [result, setResult] = useState(() =>
    seed && seed.id === id ? { phase: "ready", key: "public", id, reload: 0, data: seed.data, error: null } : null
  );
  const [reload, setReload] = useState(0);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const matches = Boolean(result && result.key === viewer.key && result.id === id && result.reload === reload);

  useEffect(() => {
    if (!enabled || viewer.mode === "pending" || matches) return undefined;
    const gate = createRequestGate();
    const token = gate.begin();
    const get = (path) => storeFetch(path, viewer.mode === "private" ? {} : { public: true });
    loadRef
      .current(get, () => gate.isCurrent(token))
      .then((data) => {
        if (gate.isCurrent(token)) setResult({ phase: "ready", key: viewer.key, id, reload, data, error: null });
      })
      .catch((error) => {
        if (!gate.isCurrent(token) || isStaleStoreError(error)) return;
        // The session ended while this ran; the provider is about to switch to anonymous, which
        // changes the key and starts a fresh public request.
        if (error?.reason === "session-expired" || error?.reason === "needs-login") return;
        setResult({ phase: "error", key: viewer.key, id, reload, data: null, error });
      });
    return () => gate.invalidate();
  }, [enabled, viewer.mode, viewer.key, id, reload, matches]);

  const retry = () => setReload((count) => count + 1);
  if (!enabled) return { phase: "idle", data: null, error: null, busy: false, retry };
  if (matches) return { phase: result.phase, data: result.data, error: result.error, busy: false, retry };
  if (result && result.key === viewer.key && result.phase === "ready") {
    return { phase: "ready", data: result.data, error: null, busy: true, retry };
  }
  return { phase: "loading", data: null, error: null, busy: false, retry };
}

// ---- returning to where you were -------------------------------------------------------------------

// One memory and one traversal tracker for the whole tab. They live at module level, so they
// outlive the page components (the store layout persists across navigation) and, through
// sessionStorage, a reload.
let positionMemory = null;
let traversal = null;

function getMemory() {
  if (!positionMemory) {
    let storage = null;
    try {
      storage = window.sessionStorage;
    } catch {
      storage = null;
    }
    positionMemory = createPositionMemory({ storage });
  }
  return positionMemory;
}

// A Back/Forward arrival (popstate) restores; a followed link cancels that mark. The click listener
// is capture-phase so it runs before the link navigates.
function getTraversal() {
  if (!traversal) {
    traversal = createTraversalTracker();
    window.addEventListener("popstate", () => traversal.markTraversal());
    document.addEventListener(
      "click",
      (event) => {
        if (event.target instanceof Element && event.target.closest("a[href]")) traversal.markNavigation();
      },
      true
    );
  }
  return traversal;
}

const readShelves = () => {
  const shelves = {};
  for (const shelf of document.querySelectorAll("[data-shelf-id]")) {
    if (shelf.scrollLeft > 0) shelves[shelf.getAttribute("data-shelf-id")] = Math.round(shelf.scrollLeft);
  }
  return shelves;
};

/**
 * Remembers where the visitor was on this route (vertical, and each shelf's horizontal position)
 * and puts them back when they return by Back/Forward once the content is on screen.
 * A fresh link, a typed URL or a reload starts at the top as usual.
 *   routeKey: path plus query of this page (stable per list/filter/page).
 *   ready:    true when the page's content is rendered (data loaded).
 * The position is saved on scroll and when a link is followed, and never overwritten by the
 * scroll-to-top of the navigation itself.
 */
export function useScrollRetention(routeKey, ready) {
  const restoredFor = useRef(null);

  useEffect(() => {
    const memory = getMemory();
    getTraversal();
    let frame = 0;
    let leaving = false;
    let timer = 0;
    const snapshot = () => memory.set(routeKey, { y: window.scrollY, shelves: readShelves() });
    const onScroll = () => {
      if (leaving || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!leaving) snapshot();
      });
    };
    const onClick = (event) => {
      if (!(event.target instanceof Element) || !event.target.closest("a[href]")) return;
      snapshot();
      leaving = true;
      clearTimeout(timer);
      timer = setTimeout(() => {
        leaving = false;
      }, 1000);
    };
    const onHide = () => {
      if (!leaving) snapshot();
      memory.persist();
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    document.addEventListener("click", onClick, true);
    window.addEventListener("pagehide", onHide);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      document.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("pagehide", onHide);
      memory.persist();
    };
  }, [routeKey]);

  useEffect(() => {
    if (!ready || restoredFor.current === routeKey) return undefined;
    restoredFor.current = routeKey;
    if (!getTraversal().consume()) return undefined;
    const saved = getMemory().get(routeKey);
    if (!saved) return undefined;
    const frame = requestAnimationFrame(() => {
      for (const shelf of document.querySelectorAll("[data-shelf-id]")) {
        const x = saved.shelves[shelf.getAttribute("data-shelf-id")];
        if (x) shelf.scrollLeft = x;
      }
      // The page sets scroll-behavior: smooth; a restored position must not animate from the top.
      window.scrollTo({ top: saved.y, left: 0, behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [ready, routeKey]);
}

// The cart is the provider's retailer.cart = { quantityOf(skuId), setQuantity(skuId, qty), ... }, which
// exists for a ready retailer once their own cart is restored (09-07). The local quantity below only
// covers the moment before that; a held add waits for the cart (see useResumePendingAdd).
function useCart() {
  const retailer = useRetailer();
  return { retailer, cart: retailer.cart || null };
}

/** Applies an add that was held across login once a cart can take it. Mount once per page. */
export function useResumePendingAdd(viewer) {
  const { pendingIntent, takeIntent } = useRetailer();
  const { cart } = useCart();
  useEffect(() => {
    const resume = decideAddResume({ intent: pendingIntent, viewer, cartAvailable: Boolean(cart) });
    if (!resume) return;
    takeIntent();
    cart.setQuantity(resume.skuId, resume.quantity);
  }, [pendingIntent, viewer, cart, takeIntent]);
}

// ---- purchase control -----------------------------------------------------------------------------

const UNAVAILABLE_LABEL = {
  "out-of-stock": "Out of stock",
  "no-price": "Price unavailable",
  "no-limit": "Unavailable"
};

/** The stepper's count: whole packs with their pieces beneath, or pieces alone for a loose product. */
export function QuantityOutput({ quantity, item, label }) {
  const { size, name } = packOf(item);
  return (
    <output aria-live="polite" aria-label={label}>
      {size > 1 ? (
        <>
          <span className="store-qty__packs">
            {Math.floor(quantity / size)} {name}
          </span>
          <span className="store-qty__pieces">{piecesLabel(quantity)}</span>
        </>
      ) : (
        quantity
      )}
    </output>
  );
}

/**
 * Add, then minus / quantity / plus, a whole pack (ladi) at a time, for any visitor: a guest's cart is
 * kept in the browser and login is asked for at Place order. Out of stock and missing price block it.
 */
export function PurchaseControl({ product }) {
  const { cart } = useCart();
  const [localQuantity, setLocalQuantity] = useState(0);
  const state = purchaseState(product);
  const max = state.action === "add" ? state.max : 0;
  const { size } = packOf(product);
  const quantity = cart ? clampQuantity(cart.quantityOf(product.id), max, size) : clampQuantity(localQuantity, max, size);
  const setQuantity = (next) => (cart ? cart.setQuantity(product.id, next) : setLocalQuantity(next));

  if (state.action === "none") {
    const label = UNAVAILABLE_LABEL[state.reason] || "Unavailable";
    return (
      <button type="button" className="store-add" disabled aria-label={`Add ${product.name} (${label.toLowerCase()})`}>
        {label}
      </button>
    );
  }

  if (quantity < 1) {
    return (
      <button type="button" className="store-add" aria-label={`Add ${product.name}`} onClick={() => setQuantity(size)}>
        Add
      </button>
    );
  }

  const atMax = stepQuantity(quantity, 0, max, size).capped;
  return (
    <div className="store-qty-wrap">
      <div className="store-qty" role="group" aria-label={`Quantity of ${product.name}`}>
        <button
          type="button"
          aria-label={`Decrease quantity of ${product.name}`}
          onClick={() => setQuantity(stepQuantity(quantity, -1, max, size).quantity)}
        >
          <Minus size={18} strokeWidth={2} aria-hidden="true" />
        </button>
        <QuantityOutput quantity={quantity} item={product} label={`${product.name} quantity`} />
        <button
          type="button"
          aria-label={`Increase quantity of ${product.name}`}
          disabled={atMax}
          onClick={() => setQuantity(stepQuantity(quantity, 1, max, size).quantity)}
        >
          <Plus size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
      {atMax ? (
        <p className="store-qty__max" role="status">
          Maximum available
        </p>
      ) : null}
    </div>
  );
}

/** The trade price (per ladi first, then per piece and MRP), or MRP when no trade price is set. */
export function PriceBlock({ product }) {
  const price = displayPrice(product);
  const mrp = price.mrp === null ? null : formatCurrency(price.mrp);
  const { size, name } = packOf(product);
  if (price.kind === "trade") {
    // Per ladi first, the way it is bought; the per-piece price and MRP beneath it.
    return (
      <div className="store-price">
        <p className="store-price__line">
          <span className="store-price__now">{formatCurrency(size > 1 ? Math.round(price.tradePrice * size * 100) / 100 : price.tradePrice)}</span>{" "}
          <span className="store-price__unit">per {size > 1 ? name : "pc"}</span>
        </p>
        {size > 1 ? (
          <p className="store-price__mrp">
            {formatCurrency(price.tradePrice)} per pc{mrp ? ` · MRP ${mrp}` : ""}
          </p>
        ) : mrp ? (
          <p className="store-price__mrp">MRP {mrp}</p>
        ) : null}
      </div>
    );
  }
  return (
    <div className="store-price">
      {mrp ? <p className="store-price__line store-price__now">MRP {mrp}{size > 1 ? " per pc" : ""}</p> : null}
      <p className="store-price__prompt">Trade price unavailable</p>
    </div>
  );
}

// ---- cards, shelves, grids -----------------------------------------------------------------------

/** "23 g · 1 ladi = 12 pcs": the weight and, for a pack product, what one pack holds. */
export function packLine(product) {
  const { size, name } = packOf(product);
  const pack = size > 1 ? `1 ${name} = ${piecesLabel(size)}` : null;
  return [product.pack_size, pack].filter(Boolean).join(" · ");
}

export function ProductCard({ product, viewer, lazy = false }) {
  return (
    <li className="store-card store-product-card" data-store-product-id={product.id}>
      <Link href={`/products/${product.id}`} className="store-card__link">
        <ProductImage src={product.image_url} lazy={lazy} />
        <p className="store-card__name" title={product.name}>
          {product.name}
        </p>
      </Link>
      <p className="store-card__pack">{packLine(product) || " "}</p>
      <PriceBlock product={product} />
      <PurchaseControl product={product} />
    </li>
  );
}

/** Real products in a swipeable row with a See all link that never needs a swipe. */
export function ProductShelf({ shelfId, title, href, products, viewer }) {
  const headingId = useId();
  if (!products?.length) return null;
  return (
    <section className="store-section" aria-labelledby={headingId}>
      <div className="store-section__head">
        <h2 id={headingId}>{title}</h2>
        {href ? (
          <Link href={href} className="store-see-all" aria-label={`See all ${title}`}>
            See all
          </Link>
        ) : null}
      </div>
      <ul className="store-shelf" data-shelf-id={shelfId}>
        {products.map((product, index) => (
          <ProductCard key={product.id} product={product} viewer={viewer} lazy={index >= 3} />
        ))}
      </ul>
    </section>
  );
}

export function ProductGrid({ products, viewer, eagerCount = 4 }) {
  return (
    <ul className="store-grid">
      {products.map((product, index) => (
        <ProductCard key={product.id} product={product} viewer={viewer} lazy={index >= eagerCount} />
      ))}
    </ul>
  );
}

export function ProductSkeletons({ count = 6 }) {
  return (
    <div aria-busy="true">
      <p className="sr-only" role="status">
        Loading products
      </p>
      <ul className="store-grid" aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <li key={index} className="store-card store-skeleton-card">
            <div className="store-skeleton-tile" />
            <div className="store-skeleton-bar" />
            <div className="store-skeleton-bar store-skeleton-bar--short" />
            <div className="store-skeleton-bar store-skeleton-bar--button" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CatalogueError({ onRetry }) {
  return (
    <div className="store-state" role="alert">
      <p>We couldn&apos;t load products. Please try again.</p>
      <button type="button" className="store-button" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

// ---- categories -------------------------------------------------------------------------------------

// A category's own image when the admin set one (a photo that fills the tile), otherwise a real
// pack shot from the category, otherwise a neutral local illustration matched on the real name.
function CategoryArt({ category, coverUrl }) {
  const url = category.icon_url;
  if (typeof url === "string" && url.startsWith("https://")) {
    // eslint-disable-next-line @next/next/no-img-element -- remote host is not whitelisted for next/image
    return <img className="store-category-tile__img store-category-tile__img--photo" src={url} alt="" loading="lazy" />;
  }
  if (typeof coverUrl === "string" && coverUrl.startsWith("https://")) {
    // eslint-disable-next-line @next/next/no-img-element -- remote host is not whitelisted for next/image
    return <img className="store-category-tile__img store-category-tile__img--pack" src={coverUrl} alt="" loading="lazy" />;
  }
  const name = String(category.name || "").toLowerCase();
  const Icon = /nut|seed|fruit/.test(name)
    ? Nut
    : /namkeen|bhujia|mixture|sev/.test(name)
      ? Wheat
      : /chip|crisp|puff|popcorn/.test(name)
        ? Popcorn
        : /biscuit|cookie/.test(name)
          ? Cookie
          : Package;
  return <Icon size={32} strokeWidth={1.5} aria-hidden="true" />;
}

export function CategoryTile({ category, coverUrl }) {
  return (
    <li>
      <Link href={listingHref({ categoryId: category.id })} className="store-category-tile">
        <span className="store-category-tile__art">
          <CategoryArt category={category} coverUrl={coverUrl} />
        </span>
        <span className="store-category-tile__name">{category.name}</span>
      </Link>
    </li>
  );
}

// ---- the listing ---------------------------------------------------------------------------------------

const fetchCategories = (get) => get(storeEndpoints.categories);
const fetchBrands = (get) => get(storeEndpoints.brands);

function FilterSelect({ label, value, allLabel, options, onChange }) {
  return (
    <label className="store-filter">
      <span>{label}</span>
      <select value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * The searchable listing. The URL holds q / category_id / brand_id / page, so a reload, a shared
 * link and Back all land on the same list; the API is asked with exactly those values (bounded
 * to limit 24 per page and q up to 100). seed is the server's public first page for these params.
 */
export function ProductListing({ params, seed = null }) {
  const router = useRouter();
  const viewer = useViewer();
  const headingId = useId();
  useResumePendingAdd(viewer);

  const showChooser = params.view === "categories";
  const limit = DEFAULT_LISTING_LIMIT;
  const offset = pageOffset(params.page, limit);
  const id = productQuery({ q: params.q, categoryId: params.categoryId, brandId: params.brandId, limit, offset });

  const products = useViewerResource({
    id,
    viewer,
    seed: seed?.products,
    enabled: !showChooser,
    load: (get) => get(productsPath({ q: params.q, categoryId: params.categoryId, brandId: params.brandId, limit, offset }))
  });
  const categories = useViewerResource({ id: "categories", viewer: PUBLIC_VIEWER, seed: seed?.categories, load: fetchCategories });
  const brands = useViewerResource({ id: "brands", viewer: PUBLIC_VIEWER, seed: seed?.brands, load: fetchBrands });

  const categoryList = categories.data || [];
  const brandList = brands.data || [];
  const category = categoryList.find((item) => item.id === params.categoryId);
  const brand = brandList.find((item) => item.id === params.brandId);
  const filtered = Boolean(params.q || params.categoryId || params.brandId);

  const title = params.q
    ? `Results for “${params.q}”`
    : category?.name || brand?.name || (showChooser ? "Categories" : "All products");

  const go = (next) => router.push(listingHref({ ...params, view: null, page: 1, ...next }));

  const items = sortAvailableLast(products.data?.items || []);
  const total = products.data?.total ?? 0;
  const pages = totalPages(total, limit);

  useScrollRetention(listingHref(params), showChooser ? categories.phase === "ready" : products.phase === "ready" && !products.busy);

  return (
    <section className="store-listing" aria-labelledby={headingId}>
      <div className="store-page-head">
        <h1 id={headingId}>{title}</h1>
        {showChooser ? (
          <Link className="store-text-link" href="/products">
            All products
          </Link>
        ) : null}
      </div>

      {showChooser ? (
        categories.phase === "error" ? (
          <CatalogueError onRetry={categories.retry} />
        ) : categories.phase !== "ready" ? (
          <p role="status">Loading categories</p>
        ) : categoryList.length === 0 ? (
          <p>No categories yet.</p>
        ) : (
          <ul className="store-category-grid">
            {categoryList.map((item) => (
              <CategoryTile key={item.id} category={item} />
            ))}
          </ul>
        )
      ) : (
        <>
          {categoryList.length || brandList.length ? (
            <div className="store-filters">
              {categoryList.length ? (
                <FilterSelect
                  label="Category"
                  allLabel="All categories"
                  value={params.categoryId}
                  options={categoryList}
                  onChange={(value) => go({ categoryId: value ? Number(value) : null })}
                />
              ) : null}
              {brandList.length ? (
                <FilterSelect
                  label="Brand"
                  allLabel="All brands"
                  value={params.brandId}
                  options={brandList}
                  onChange={(value) => go({ brandId: value ? Number(value) : null })}
                />
              ) : null}
            </div>
          ) : null}

          {products.phase === "error" ? (
            <CatalogueError onRetry={products.retry} />
          ) : products.phase !== "ready" ? (
            <ProductSkeletons />
          ) : items.length === 0 ? (
            <div className="store-state">
              <h2>No products found</h2>
              <p>Try another name or browse categories.</p>
              <div className="store-state__actions">
                <Link className="store-button" href="/products?view=categories">
                  Browse categories
                </Link>
                {filtered ? (
                  <Link className="store-text-link" href="/products">
                    Clear filters
                  </Link>
                ) : null}
                {total > 0 && params.page > 1 ? (
                  <Link className="store-text-link" href={listingHref({ ...params, page: 1 })}>
                    Back to the first page
                  </Link>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="store-results" aria-busy={products.busy ? "true" : undefined}>
              <p className="store-results__count" role="status">
                {total === 1 ? "1 product" : `${total} products`}
              </p>
              <ProductGrid products={items} viewer={viewer} />
              {pages > 1 ? (
                <nav className="store-pager" aria-label="Pages">
                  {params.page > 1 ? (
                    <Link href={listingHref({ ...params, page: params.page - 1 })} rel="prev">
                      Previous
                    </Link>
                  ) : (
                    <span />
                  )}
                  <span>
                    Page {params.page} of {pages}
                  </span>
                  {params.page < pages ? (
                    <Link href={listingHref({ ...params, page: params.page + 1 })} rel="next">
                      Next
                    </Link>
                  ) : (
                    <span />
                  )}
                </nav>
              ) : null}
            </div>
          )}
        </>
      )}
    </section>
  );
}
