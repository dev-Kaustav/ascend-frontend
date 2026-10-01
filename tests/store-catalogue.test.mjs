// Behaviour tests for the storefront catalogue decisions. node:test, no framework, no network:
//
//   node --test tests/store-catalogue.test.mjs
//
// Every test drives the real exports from lib/store/catalogue.mjs. The pure module decides what a
// listing asks the API for, what price a viewer may see, which products can be bought, which
// request result is allowed to win, and which related products are shown. Rendering and real
// network behaviour are covered by the browser scenarios, not here.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_LISTING_LIMIT,
  MAX_LINE_QUANTITY,
  MAX_PAGE_LIMIT,
  MAX_QUERY_LENGTH,
  clampQuantity,
  createRequestGate,
  FEATURE_BRAND_NAME,
  HOME_MAX_PAGES,
  HOME_SHELF_LIMIT,
  createPositionMemory,
  createTraversalTracker,
  decideAddResume,
  displayPrice,
  findFeatureBrand,
  groupShelves,
  isAvailable,
  listingHref,
  loadProductPages,
  pageOffset,
  parseListingParams,
  parseProductId,
  routeKeyOf,
  productQuery,
  productsPath,
  purchaseState,
  similarProducts,
  sortAvailableLast,
  stepQuantity,
  totalPages,
  viewerKey
} from "../lib/store/catalogue.mjs";

const product = (id, extra = {}) => ({
  id,
  name: `Product ${id}`,
  brand: { id: 1, name: "Jabsons" },
  category: { id: 4, name: "Dry Fruits" },
  mrp: 30,
  in_stock: true,
  ...extra
});
const ready = { mode: "private", key: "private:3", canPurchase: true };
const anonymous = { mode: "public", key: "public", canPurchase: false };

// ---- the query a listing sends ------------------------------------------------------------

test("q, category_id and brand_id stay separate parameters", () => {
  const query = new URLSearchParams(productQuery({ q: "cashew", categoryId: 4, brandId: 1 }));
  assert.equal(query.get("q"), "cashew");
  assert.equal(query.get("category_id"), "4");
  assert.equal(query.get("brand_id"), "1");
});

test("a brand is never searched for through q", () => {
  const query = new URLSearchParams(productQuery({ brandId: 1 }));
  assert.equal(query.get("brand_id"), "1");
  assert.equal(query.has("q"), false, "brand selection must not become SKU text search");
});

test("q is trimmed, empty q is omitted and q is capped to 100 code points", () => {
  assert.equal(new URLSearchParams(productQuery({ q: "   " })).has("q"), false);
  assert.equal(new URLSearchParams(productQuery({ q: "  nuts  " })).get("q"), "nuts");

  const long = new URLSearchParams(productQuery({ q: "a".repeat(250) })).get("q");
  assert.equal(long.length, MAX_QUERY_LENGTH);

  // 100 code points, never a split surrogate pair (encoding a lone surrogate would corrupt q).
  const emoji = new URLSearchParams(productQuery({ q: "\u{1F95C}".repeat(150) })).get("q");
  assert.equal(Array.from(emoji).length, MAX_QUERY_LENGTH);
  assert.doesNotMatch(emoji, /�/);
});

test("limit is an integer between 1 and 100 and offset is a whole number from 0", () => {
  const get = (args) => new URLSearchParams(productQuery(args));
  assert.equal(get({}).get("limit"), String(DEFAULT_LISTING_LIMIT));
  assert.equal(get({ limit: 500 }).get("limit"), String(MAX_PAGE_LIMIT));
  assert.equal(get({ limit: 0 }).get("limit"), "1");
  assert.equal(get({ limit: 12.7 }).get("limit"), "12");
  assert.equal(get({ limit: "abc" }).get("limit"), String(DEFAULT_LISTING_LIMIT));
  assert.equal(get({ offset: -5 }).get("offset"), "0");
  assert.equal(get({ offset: 48.9 }).get("offset"), "48");
  assert.equal(get({ offset: "NaN" }).get("offset"), "0");
});

test("ids that are not positive whole numbers are dropped, not sent", () => {
  const get = (args) => new URLSearchParams(productQuery(args));
  for (const bad of [0, -1, 2.5, "x", "1; DROP", NaN, null, undefined]) {
    assert.equal(get({ categoryId: bad }).has("category_id"), false, `category ${String(bad)}`);
    assert.equal(get({ brandId: bad }).has("brand_id"), false, `brand ${String(bad)}`);
  }
});

test("productsPath targets the public catalogue endpoint", () => {
  assert.match(productsPath({ q: "x" }), /^\/store\/products\?/);
});

// ---- the URL is the source of truth for filters ---------------------------------------------

test("parseListingParams reads a Next searchParams object, taking the first of repeated values", () => {
  const parsed = parseListingParams({ q: ["salt", "ignored"], category_id: "5", brand_id: "1", page: "3" });
  assert.deepEqual(parsed, { q: "salt", categoryId: 5, brandId: 1, page: 3, view: null });
});

test("parseListingParams reads URLSearchParams and survives hostile values", () => {
  assert.deepEqual(parseListingParams(new URLSearchParams("q=%20hi%20&category_id=abc&brand_id=-3&page=0&view=x")), {
    q: "hi",
    categoryId: null,
    brandId: null,
    page: 1,
    view: null
  });
  assert.equal(parseListingParams({ q: "z".repeat(400) }).q.length, MAX_QUERY_LENGTH);
  assert.equal(parseListingParams({ view: "categories" }).view, "categories");
  assert.equal(parseListingParams(undefined).page, 1);
  assert.equal(parseListingParams({ page: "99999999999" }).page, 1, "an absurd page number is not accepted");
});

test("listingHref round-trips through parseListingParams", () => {
  const samples = [
    { q: "", categoryId: null, brandId: null, page: 1, view: null },
    { q: "cashew nuts & more", categoryId: 4, brandId: 1, page: 1, view: null },
    { q: "", categoryId: null, brandId: 1, page: 2, view: null },
    { q: "peri peri", categoryId: 6, brandId: null, page: 5, view: null },
    { q: "", categoryId: null, brandId: null, page: 1, view: "categories" }
  ];
  for (const sample of samples) {
    const href = listingHref(sample);
    assert.ok(href.startsWith("/products"), href);
    const back = parseListingParams(new URL(href, "https://store.invalid").searchParams);
    assert.deepEqual(back, sample, href);
  }
});

test("listingHref omits defaults and never carries the categories view with a filter", () => {
  assert.equal(listingHref({}), "/products");
  assert.equal(listingHref({ page: 1 }), "/products");
  assert.equal(listingHref({ view: "categories", categoryId: 4 }), "/products?category_id=4");
});

test("page maths", () => {
  assert.equal(pageOffset(1, 24), 0);
  assert.equal(pageOffset(3, 24), 48);
  assert.equal(pageOffset(0, 24), 0);
  assert.equal(totalPages(0, 24), 1);
  assert.equal(totalPages(24, 24), 1);
  assert.equal(totalPages(25, 24), 2);
  assert.equal(totalPages(60, 24), 3);
});

// ---- ordering ---------------------------------------------------------------------------------

test("unavailable products stay visible and sort last, keeping their relative order", () => {
  const list = [
    product(1, { in_stock: false }),
    product(2),
    product(3, { in_stock: false }),
    product(4),
    product(5, { max_orderable: 0 }),
    product(6, { max_orderable: 9 })
  ];
  const sorted = sortAvailableLast(list);
  assert.deepEqual(sorted.map((p) => p.id), [2, 4, 6, 1, 3, 5]);
  assert.equal(sorted.length, list.length, "nothing is dropped");
  assert.deepEqual(list.map((p) => p.id), [1, 2, 3, 4, 5, 6], "the input is not mutated");
});

test("isAvailable needs stock and, for a retailer, a positive cap", () => {
  assert.equal(isAvailable(product(1)), true);
  assert.equal(isAvailable(product(1, { in_stock: false })), false);
  assert.equal(isAvailable(product(1, { max_orderable: 0 })), false);
  assert.equal(isAvailable(product(1, { max_orderable: 3 })), true);
});

// ---- identity and price -----------------------------------------------------------------------

test("an anonymous viewer sees MRP and a login prompt, never a trade price", () => {
  const price = displayPrice(product(1, { trade_price: 18, mrp: 30 }), anonymous);
  assert.equal(price.kind, "mrp");
  assert.equal(price.mrp, 30);
  assert.equal(price.loginPrompt, true);
  assert.equal(price.tradePrice, null, "a trade_price in the payload must not leak to a non-ready viewer");
});

test("a retailer who is not ready (new, confirm, error) is treated like an anonymous viewer", () => {
  for (const readiness of ["new", "confirm", "error"]) {
    const key = viewerKey({ status: "authed", readiness, generation: 3 });
    const price = displayPrice(product(1, { trade_price: 18 }), key);
    assert.equal(price.kind, "mrp", readiness);
    assert.equal(price.tradePrice, null, readiness);
  }
});

test("a ready retailer sees the server's trade price per packet with MRP secondary", () => {
  const price = displayPrice(product(1, { trade_price: 21.5, mrp: 30 }), ready);
  assert.equal(price.kind, "trade");
  assert.equal(price.tradePrice, 21.5);
  assert.equal(price.mrp, 30);
  assert.equal(price.perPacket, true);
  assert.equal(price.loginPrompt, false);
});

test("a ready retailer without a usable trade price gets no price and no purchase", () => {
  for (const extra of [{}, { trade_price: null }, { trade_price: 0 }, { trade_price: "18" }, { trade_price: NaN }]) {
    const item = product(1, { max_orderable: 5, ...extra });
    assert.equal(displayPrice(item, ready).kind, "unavailable", JSON.stringify(extra));
    assert.deepEqual(purchaseState(item, ready), { action: "none", reason: "no-price" });
  }
});

test("purchaseState: out of stock, login gate, add with its cap", () => {
  assert.deepEqual(purchaseState(product(1, { in_stock: false }), anonymous), { action: "none", reason: "out-of-stock" });
  assert.deepEqual(purchaseState(product(1, { in_stock: false, trade_price: 18, max_orderable: 0 }), ready), {
    action: "none",
    reason: "out-of-stock"
  });
  assert.deepEqual(purchaseState(product(1), anonymous), { action: "gate", reason: "login" });
  assert.deepEqual(purchaseState(product(1, { trade_price: 18, max_orderable: 12 }), ready), { action: "add", max: 12 });
  // max_orderable is already capped by the server at 999; a larger value is still bounded here.
  assert.equal(purchaseState(product(1, { trade_price: 18, max_orderable: 5000 }), ready).max, MAX_LINE_QUANTITY);
  // A ready retailer response with no cap cannot be bought against.
  assert.deepEqual(purchaseState(product(1, { trade_price: 18 }), ready), { action: "none", reason: "no-limit" });
});

test("quantities are whole packets, never above the cap, never negative", () => {
  assert.equal(clampQuantity(3, 10), 3);
  assert.equal(clampQuantity(30, 10), 10);
  assert.equal(clampQuantity(-4, 10), 0);
  assert.equal(clampQuantity(2.9, 10), 2);
  assert.equal(clampQuantity("x", 10), 0);
  assert.equal(clampQuantity(5, 0), 0);

  assert.deepEqual(stepQuantity(0, 1, 3), { quantity: 1, capped: false });
  assert.deepEqual(stepQuantity(2, 1, 3), { quantity: 3, capped: true });
  assert.deepEqual(stepQuantity(3, 1, 3), { quantity: 3, capped: true }, "plus at the cap changes nothing and says so");
  assert.deepEqual(stepQuantity(1, -1, 3), { quantity: 0, capped: false }, "minus to zero removes");
  assert.deepEqual(stepQuantity(0, -1, 3), { quantity: 0, capped: false });
});

test("viewerKey: pending until readiness is known, public unless ready, private per generation", () => {
  assert.deepEqual(viewerKey({ status: "loading", readiness: "loading", generation: null }), {
    mode: "pending",
    key: "public",
    canPurchase: false
  });
  assert.deepEqual(viewerKey({ status: "anonymous", readiness: "anonymous", generation: 1 }), {
    mode: "public",
    key: "public",
    canPurchase: false
  });
  assert.equal(viewerKey({ status: "expired", readiness: "anonymous", generation: 2 }).mode, "public");
  assert.deepEqual(viewerKey({ status: "authed", readiness: "loading", generation: 3 }), {
    mode: "pending",
    key: "pending",
    canPurchase: false
  });
  assert.deepEqual(viewerKey({ status: "authed", readiness: "ready", generation: 3 }), {
    mode: "private",
    key: "private:3",
    canPurchase: true
  });
  // A different account is a different key, so its results can never be shown to the first.
  assert.notEqual(
    viewerKey({ status: "authed", readiness: "ready", generation: 3 }).key,
    viewerKey({ status: "authed", readiness: "ready", generation: 4 }).key
  );
  for (const readiness of ["new", "confirm", "error"]) {
    assert.equal(viewerKey({ status: "authed", readiness, generation: 3 }).mode, "public", readiness);
  }
});

// ---- races -------------------------------------------------------------------------------------

test("a stale request can never win over a newer one", async () => {
  const gate = createRequestGate();
  const applied = [];
  const slow = gate.begin();
  const fast = gate.begin();
  // The newer request answers first; the older one answers afterwards.
  if (gate.isCurrent(fast)) applied.push("fast");
  await Promise.resolve();
  if (gate.isCurrent(slow)) applied.push("slow");
  assert.deepEqual(applied, ["fast"]);
});

test("invalidate drops whatever is in flight, for example on an identity change or unmount", () => {
  const gate = createRequestGate();
  const token = gate.begin();
  assert.equal(gate.isCurrent(token), true);
  gate.invalidate();
  assert.equal(gate.isCurrent(token), false);
  assert.equal(gate.isCurrent(gate.begin()), true);
});

// ---- related products ---------------------------------------------------------------------------

test("similar products exclude the current SKU, repeat nothing and push unavailable ones last", () => {
  const items = [
    product(7),
    product(8, { in_stock: false }),
    product(9),
    product(9),
    product(10),
    product(11, { in_stock: false })
  ];
  assert.deepEqual(similarProducts(items, 7).map((p) => p.id), [9, 10, 8, 11]);
  assert.deepEqual(similarProducts(items, "7").map((p) => p.id), [9, 10, 8, 11], "id as a string from the URL");
  assert.deepEqual(similarProducts(items, 7, 2).map((p) => p.id), [9, 10]);
});

test("zero related products is an empty list, not a placeholder", () => {
  assert.deepEqual(similarProducts([product(7)], 7), []);
  assert.deepEqual(similarProducts([], 7), []);
  assert.deepEqual(similarProducts(undefined, 7), []);
});

// ---- a product add held across login --------------------------------------------------------------

test("a held add resumes only for a ready retailer once a cart can take it", () => {
  const intent = { type: "add", skuId: 9, quantity: 2 };
  assert.deepEqual(decideAddResume({ intent, viewer: ready, cartAvailable: true }), { skuId: 9, quantity: 2 });
  assert.equal(decideAddResume({ intent, viewer: ready, cartAvailable: false }), null, "no cart yet: keep it held");
  assert.equal(decideAddResume({ intent, viewer: anonymous, cartAvailable: true }), null);
  assert.equal(decideAddResume({ intent: { type: "navigate", href: "/orders" }, viewer: ready, cartAvailable: true }), null);
  assert.equal(decideAddResume({ intent: null, viewer: ready, cartAvailable: true }), null);
  assert.deepEqual(
    decideAddResume({ intent: { type: "add", skuId: 9, quantity: 5000 }, viewer: ready, cartAvailable: true }),
    { skuId: 9, quantity: MAX_LINE_QUANTITY }
  );
});

test("a product id from the URL is a positive whole number or nothing", () => {
  assert.equal(parseProductId("7"), 7);
  for (const bad of ["0", "-1", "07", "1.5", "abc", "7/../8", "", undefined, null]) assert.equal(parseProductId(bad), null, String(bad));
});

// ---- the home -------------------------------------------------------------------------------------------

const withCategory = (id, categoryId, extra = {}) => product(id, { category: { id: categoryId, name: `Cat ${categoryId}` }, ...extra });

test("loadProductPages reads every page, stops when complete and returns each product once", async () => {
  const all = Array.from({ length: 230 }, (_, i) => product(i + 1));
  const calls = [];
  const result = await loadProductPages(async ({ limit, offset }) => {
    calls.push({ limit, offset });
    return { items: all.slice(offset, offset + limit), total: all.length };
  });
  assert.equal(result.items.length, 230);
  assert.equal(result.total, 230);
  assert.equal(result.complete, true);
  assert.deepEqual(calls, [{ limit: 100, offset: 0 }, { limit: 100, offset: 100 }, { limit: 100, offset: 200 }]);
  assert.equal(new Set(result.items.map((p) => p.id)).size, 230);
});

test("loadProductPages makes one request when the catalogue fits in a page", async () => {
  let calls = 0;
  const result = await loadProductPages(async () => {
    calls += 1;
    return { items: [product(1), product(2)], total: 2 };
  });
  assert.equal(calls, 1);
  assert.equal(result.complete, true);
});

test("loadProductPages is bounded: a server that never finishes cannot make it loop", async () => {
  let calls = 0;
  const result = await loadProductPages(async ({ limit, offset }) => {
    calls += 1;
    return { items: Array.from({ length: limit }, (_, i) => product(offset + i + 1)), total: 1000000 };
  });
  assert.equal(calls, HOME_MAX_PAGES);
  assert.equal(result.complete, false);
  assert.equal(result.items.length, HOME_MAX_PAGES * 100);
});

test("loadProductPages stops on an empty or short page and when the result is abandoned", async () => {
  let calls = 0;
  const empty = await loadProductPages(async () => {
    calls += 1;
    return { items: [], total: 50 };
  });
  assert.equal(calls, 1);
  assert.deepEqual(empty, { items: [], total: 50, complete: false });

  let stale = 0;
  const abandoned = await loadProductPages(
    async ({ limit, offset }) => {
      stale += 1;
      return { items: Array.from({ length: limit }, (_, i) => product(offset + i + 1)), total: 500 };
    },
    { isCurrent: () => stale < 1 }
  );
  assert.equal(abandoned, null);
  assert.equal(stale, 1, "no further pages are fetched once the result is stale");
});

test("loadProductPages lets a failed page reject instead of returning a partial list as complete", async () => {
  await assert.rejects(
    loadProductPages(async ({ offset }) => {
      if (offset > 0) throw new Error("down");
      return { items: Array.from({ length: 100 }, (_, i) => product(i + 1)), total: 150 };
    }),
    /down/
  );
});

test("shelves: one per category that has products, API order, no filler, none empty", () => {
  const products = [
    withCategory(1, 4),
    withCategory(2, 4, { in_stock: false }),
    withCategory(3, 4),
    withCategory(4, 6),
    withCategory(5, 9) // a category the categories endpoint did not list
  ];
  const categories = [{ id: 6, name: "Namkeen" }, { id: 5, name: "Empty category" }, { id: 4, name: "Dry fruits" }];
  const shelves = groupShelves(products, categories);
  assert.deepEqual(shelves.map((s) => s.category.id), [6, 4], "empty category omitted, API order kept");
  assert.deepEqual(shelves[1].products.map((p) => p.id), [1, 3, 2], "unavailable last, nothing repeated");
  assert.equal(shelves[1].total, 3);
  assert.deepEqual(groupShelves([], categories), []);
  assert.deepEqual(groupShelves(products, []), []);
});

test("a shelf is capped, not padded", () => {
  const products = Array.from({ length: 25 }, (_, i) => withCategory(i + 1, 4));
  const [shelf] = groupShelves(products, [{ id: 4, name: "Cat" }]);
  assert.equal(shelf.products.length, HOME_SHELF_LIMIT);
  assert.equal(shelf.total, 25);
  const [one] = groupShelves([withCategory(1, 4)], [{ id: 4, name: "Cat" }]);
  assert.equal(one.products.length, 1, "one product is one card, not a repeated row");
});

test("the featured brand is found by the returned name, with its real count and images", () => {
  const brands = [{ id: 22, name: "Other" }, { id: 90, name: "jabsons " }];
  const products = [
    product(1, { brand: { id: 90, name: "Jabsons" }, image_url: "https://img/a.png" }),
    product(2, { brand: { id: 90, name: "Jabsons" }, image_url: "https://img/a.png" }), // same image
    product(3, { brand: { id: 90, name: "Jabsons" }, image_url: "http://insecure/b.png" }),
    product(4, { brand: { id: 90, name: "Jabsons" }, image_url: null }),
    product(5, { brand: { id: 90, name: "Jabsons" }, image_url: "https://img/c.png", in_stock: false }),
    product(6, { brand: { id: 22, name: "Other" }, image_url: "https://img/z.png" })
  ];
  const feature = findFeatureBrand(brands, products);
  assert.equal(FEATURE_BRAND_NAME, "Jabsons");
  assert.equal(feature.brand.id, 90, "the id comes from the data, not a constant");
  assert.equal(feature.count, 5);
  assert.deepEqual(feature.thumbs, ["https://img/a.png", "https://img/c.png"], "https only, no repeats, available first");
  assert.equal(findFeatureBrand([{ id: 1, name: "Other" }], products), null, "an absent brand is no feature, not a guess");
  assert.equal(findFeatureBrand(undefined, undefined), null);
});

// ---- returning to where you were ---------------------------------------------------------------------------

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { data, getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)) };
}

test("a position is remembered per route and per shelf", () => {
  const memory = createPositionMemory();
  memory.set("/products?category_id=4", { y: 812, shelves: { "category-4": 240 } });
  assert.deepEqual(memory.get("/products?category_id=4"), { y: 812, shelves: { "category-4": 240 } });
  assert.equal(memory.get("/products?category_id=5"), null, "another filter is another position");
  assert.equal(routeKeyOf("/products", "?q=a"), "/products?q=a");
});

test("positions survive a reload through storage, and bad data is ignored", () => {
  const storage = memoryStorage();
  const first = createPositionMemory({ storage });
  first.set("/", { y: 1500, shelves: { "category-6": 96 } });
  first.persist();
  const reloaded = createPositionMemory({ storage });
  assert.deepEqual(reloaded.get("/"), { y: 1500, shelves: { "category-6": 96 } });

  const corrupt = createPositionMemory({ storage: memoryStorage({ ascend_store_positions: "{not json" }) });
  assert.equal(corrupt.get("/"), null);
  const hostile = createPositionMemory({ storage: memoryStorage({ ascend_store_positions: JSON.stringify([["/", { y: "x" }], ["/a", { y: -5 }], [7, { y: 1 }]]) }) });
  assert.equal(hostile.get("/"), null);
  assert.equal(hostile.get("/a"), null);
});

test("storage that throws never breaks the in-memory position", () => {
  const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("full"); } };
  const memory = createPositionMemory({ storage: broken });
  memory.set("/", { y: 10, shelves: {} });
  assert.doesNotThrow(() => memory.persist());
  assert.equal(memory.get("/").y, 10);
});

test("the memory is bounded and keeps the most recent routes", () => {
  const memory = createPositionMemory({ limit: 3 });
  for (const route of ["/a", "/b", "/c", "/d"]) memory.set(route, { y: 1, shelves: {} });
  assert.equal(memory.get("/a"), null);
  assert.ok(memory.get("/b") && memory.get("/c") && memory.get("/d"));
  memory.set("/not-a-position", { y: Number.NaN, shelves: {} });
  assert.equal(memory.get("/not-a-position"), null);
});

test("only a Back/Forward arrival restores, once, and the mark expires", () => {
  let now = 1000;
  const tracker = createTraversalTracker(() => now, 10000);
  assert.equal(tracker.consume(), false, "a direct visit or reload has no traversal");
  tracker.markTraversal();
  assert.equal(tracker.consume(), true);
  assert.equal(tracker.consume(), false, "consumed once");

  tracker.markTraversal();
  tracker.markNavigation(); // the visitor then followed a link
  assert.equal(tracker.consume(), false);

  tracker.markTraversal();
  now += 10001; // a stale Back, such as closing a sheet, long before this navigation
  assert.equal(tracker.consume(), false);
});
