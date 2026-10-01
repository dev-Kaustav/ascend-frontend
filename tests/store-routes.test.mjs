// Route smoke for the public storefront. Uses node:test; no framework.
//
//   STORE_HTTP_SMOKE=1 node --test tests/store-routes.test.mjs
//
// Needs a running Next server (STORE_BASE_URL, default http://127.0.0.1:3000) and the store API
// it is configured with (STORE_API_BASE_URL, default http://localhost:8000). The suite is only
// anonymous GETs. Without STORE_HTTP_SMOKE=1 it is skipped, because a unit-test run has no
// servers to talk to; fixtures are not a substitute for the live route wiring checked here.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const smoke = process.env.STORE_HTTP_SMOKE === "1";
const BASE = (process.env.STORE_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const API = (process.env.STORE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");
const root = fileURLToPath(new URL("..", import.meta.url));
const opts = { skip: smoke ? false : "set STORE_HTTP_SMOKE=1 with Next and the store API running" };

async function html(path) {
  const response = await fetch(`${BASE}${path}`);
  assert.equal(response.status, 200, `${path} should be 200`);
  return response.text();
}

test("/ renders a real public product from /store/products", opts, async () => {
  const api = await (await fetch(`${API}/store/products?limit=1`)).json();
  assert.ok(api.items.length > 0, "the test catalogue needs at least one published product");
  const page = await html("/");
  const ids = [...page.matchAll(/data-store-product-id="(\d+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, [String(api.items[0].id)]);
  assert.match(page, /MRP/);
  assert.match(page, /In stock|Out of stock/);
  assert.doesNotMatch(page, /trade[_ ]price/i, "anonymous HTML must not carry trade prices");
});

test("/landing keeps the marketing composition in its original order", opts, async () => {
  const page = await html("/landing");
  assert.match(page, /ascend-marketing/);
  assert.doesNotMatch(page, /ascend-storefront/);
  const markers = [
    "marketing-nav", // Navbar
    "marketing-hero", // HeroSection
    "brand-wall", // BrandWall
    'id="why"', // ContrastSection
    'id="how-it-works"', // FulfillmentSection
    'id="range"', // RangeSection
    'id="brands"', // BrandSection
    'id="founders"', // FoundersSection
    'id="contact"', // LeadSection
    "/privacy-policy" // Footer
  ];
  let last = -1;
  for (const marker of markers) {
    const at = page.indexOf(marker, last + 1);
    assert.ok(at > last, `${marker} should appear after the previous section`);
    last = at;
  }
});

test("/ carries the footer destinations and the phone shell", opts, async () => {
  const page = await html("/");
  assert.match(page, /ascend-storefront/);
  assert.doesNotMatch(page, /ascend-marketing/);
  assert.match(page, /href="\/landing"[^>]*>About Ascend</);
  assert.match(page, /href="\/login"[^>]*>Staff sign in</);

  const search = page.match(/<form[^>]*action="\/products"[^>]*>[\s\S]*?<\/form>/);
  assert.ok(search, "search is a native GET form to /products");
  assert.match(search[0], /method="get"/i);
  assert.match(search[0], /name="q"/);
  assert.match(search[0], /maxLength="100"|maxlength="100"/i);

  const nav = page.match(/<nav class="store-bottom-nav"[\s\S]*?<\/nav>/);
  assert.ok(nav, "bottom navigation is rendered");
  for (const label of ["Home", "Categories", "Orders", "Account"]) {
    assert.match(nav[0], new RegExp(`>${label}<`), `${label} link`);
  }
  assert.match(nav[0], /aria-current="page"[^>]*>[\s\S]*?Home/, "Home is the current page on /");
  assert.match(nav[0], /href="\/products\?view=categories"/);
});

test("/login is still the staff login", opts, async () => {
  const page = await html("/login");
  assert.match(page, /Username/);
  assert.match(page, /type="password"/);
  assert.doesNotMatch(page, /ascend-storefront/);
});

test("only the store group owns the home route", () => {
  assert.equal(existsSync(`${root}app/page.js`), false, "app/page.js must not coexist with the store home");
  assert.equal(existsSync(`${root}app/(store)/page.js`), true);
  assert.equal(existsSync(`${root}app/landing/page.js`), true);
});

test("store.css is scoped to .ascend-storefront and leaves html/body alone", () => {
  const css = readFileSync(`${root}app/(store)/store.css`, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  // Collect every selector (the text before each "{"), including those inside @media blocks.
  const selectors = [...css.matchAll(/([^{}]+)\{/g)]
    .map((m) => m[1].trim())
    .filter((s) => s && !s.startsWith("@"));
  assert.ok(selectors.length > 0);
  for (const group of selectors) {
    for (const selector of group.split(",").map((s) => s.trim())) {
      assert.match(selector, /^\.(ascend-storefront|store-)/, `unscoped selector: ${selector}`);
    }
  }
});
