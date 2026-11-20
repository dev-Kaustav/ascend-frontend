"""Browser smoke test for the app shell: orders and shops for every staff role, fully mocked.

Run the Next dev server, then:
    python tests/app-shell-smoke.py
APP_TEST_URL overrides the server (default http://localhost:3000); APP_SCREENSHOT_DIR sets where
screenshots go. Every API call is answered here, so no request reaches the real backend.

Checks, at phone (390) and tablet (768) widths:
  - tapping an order in any role's list opens it as its own page (no overlay);
  - the order screen's bar offers that role's step, and the step sends the right PATCH;
  - admin's bottom tabs and More sheet; the order form posts the shop's salesman for the office;
  - shops: every role gets the app list, a page at a time from the server with numbered pages; the
    office sees salesman and beat and edits in place;
  - a shop opens its screen (report, orders, outstanding); an unpaid bill opens the order and the
    back arrow returns to the shop's Outstanding tab; admin drills Beats > beat > shop.
At a desk (1440): an admin's order row still opens the side panel; Retailers has two tabs, Shops
(what each owes, numbered pages, every field in an edit dialog) and Beats (what each beat owes).
"""
import base64
import json
import os
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from playwright.sync_api import sync_playwright

BASE = os.environ.get("APP_TEST_URL", "http://localhost:3000")
OUT = Path(os.environ.get("APP_SCREENSHOT_DIR", "/tmp/ascend-app-shell"))
OUT.mkdir(parents=True, exist_ok=True)
HIDE_DEV_OVERLAY = "nextjs-portal{display:none!important}"


def line(i, name, qty, price, disc, total, packs=None, pack_price=None):
    return {"id": i, "sku_id": i, "sku_name": name, "pack_type": "ladi" if packs else None, "units_per_pack": 12 if packs else None,
            "pack_count": packs, "pack_price": pack_price, "quantity": qty, "unit_price": price, "discount_amount": disc,
            "line_total": total, "taxes": []}


def order(status):
    trails = [{"id": 1, "order_status": "PENDING", "description": "Order created", "changed_by_name": "Sumit", "created_at": "2026-11-19T05:52:00Z"}]
    if status in ("READY_TO_SHIP", "OUT_FOR_DELIVERY"):
        trails.append({"id": 2, "order_status": "READY_TO_SHIP", "description": "Order accepted", "changed_by_name": "Admin", "created_at": "2026-11-19T07:34:00Z"})
    if status == "OUT_FOR_DELIVERY":
        trails.append({"id": 3, "order_status": "OUT_FOR_DELIVERY", "description": "Sent out with Ravi", "changed_by_name": "Admin", "created_at": "2026-11-19T08:10:00Z"})
    return {"id": 161, "status": status, "invoice_number": "JAB/25-26/0123" if status == "OUT_FOR_DELIVERY" else None,
            "delivery_driver_id": 3, "delivery_driver_name": "Ravi", "retailer_name": "Dear drink", "retailer_address_line1": "Sector 14 market",
            "retailer_city": "Gurgaon", "salesman_name": "Sumit", "warehouse_name": "City", "channel": "OFFLINE",
            "grand_total": 960, "total_amount": 960, "mrp_total": 1200, "discount_total": 240, "gst_amount": 48, "taxable_value": 912,
            "delivery_charge": 0, "amount_paid": 0, "pending_amount": 960, "payment_status": "CREDIT", "created_at": "2026-11-19T05:52:00Z",
            "can_collect_cash": True, "payments": [], "credit_notes": [], "trails": trails,
            "items": [line(1, "Roasted Peanuts - Hing MRP 10", 24, 10, 48, 192, 2, 96), line(2, "Loose cashew", 5, 60, 0, 300)]}


# The status each role finds the order in, and the step (bar label, PATCH body) it should take.
STEP = {
    "ADMIN": ("READY_TO_SHIP", "Assign rider & send out", {"status": "OUT_FOR_DELIVERY", "delivery_driver_id": 3}),
    "ACCOUNTANT": ("READY_TO_SHIP", None, None),
    "WAREHOUSE_MANAGER": ("PENDING", "Accept order", {"status": "READY_TO_SHIP"}),
    "DRIVER": ("OUT_FOR_DELIVERY", "Mark delivered", {"status": "DELIVERED"}),
    "SALESMAN": ("PENDING", None, None),
}
ROW = {"id": 161, "status": "READY_TO_SHIP", "retailer_name": "Dear drink", "to_entity_id": 9, "salesman_name": "Sumit", "grand_total": 960,
       "total_amount": 960, "pending_amount": 960, "payment_status": "CREDIT", "created_at": "2026-11-19T05:52:00Z", "channel": "OFFLINE"}
SHOPS = [{"id": 100 + i, "name": f"Shop {i}", "address_line1": "Qutum plaza", "city": "Gurgaon", "mobile_number": 9015819600 + i,
          "assigned_salesman_id": 7, "beat_id": 1 if i % 2 else None} for i in range(1, 41)]
SHOPS[0]["name"] = "Dear drink"
SHOPS[0]["id"] = 9
ORDER_LOOKUPS = {"retailers": SHOPS, "warehouses": [{"id": 1, "name": "City"}], "brands": [{"id": 1, "name": "Crax"}],
                 "skus": [{"id": 1, "name": "Roasted Peanuts - Hing MRP 10", "brand_id": 1, "mrp": 10, "amount": 8, "units_per_pack": 12, "pack_type": "ladi"}]}
SHOP = {"id": 9, "name": "Dear drink", "address_line1": "Sector 14 market", "city": "Gurgaon", "mobile_number": 9015819639,
        "salesman_name": "Sumit", "beat_id": 1, "beat_name": "DLF Phase 1",
        "report": {"orders": 3, "ordered_value": 1700, "average_order": 566.67, "collected": 1200, "outstanding": 500, "this_month": 200,
                   "last_month": 1500, "last_order_at": "2026-11-17T06:00:00Z", "aging": {"0_7": 200, "7_15": 0, "15_30": 300, "30_plus": 0},
                   "unpaid_bills": [{"order_id": 161, "invoice_number": None, "status": "DELIVERED", "created_at": "2026-10-30T06:00:00Z", "days": 20, "total": 500, "pending": 300}]}}
BEATS = [{"id": 1, "name": "DLF Phase 1", "warehouse_id": 1, "shops": 20, "outstanding": 500}, {"id": None, "name": "No beat", "warehouse_id": None, "shops": 20, "outstanding": 0}]
SALESMEN = [{"id": 7, "name": "Sumit"}, {"id": 8, "name": "Rahul"}]


def shops_page(url):
    """GET /retailers: one page of SHOPS, filtered by beat and search like the server."""
    query = {key: values[0] for key, values in parse_qs(urlparse(url).query).items()}
    rows = SHOPS
    if query.get("beat_id") == "none":
        rows = [shop for shop in rows if shop["beat_id"] is None]
    elif query.get("beat_id"):
        rows = [shop for shop in rows if str(shop["beat_id"]) == query["beat_id"]]
    if query.get("search"):
        rows = [shop for shop in rows if query["search"].lower() in shop["name"].lower()]
    offset, limit = int(query.get("offset", 0)), int(query.get("limit", 30))
    items = [{**shop, "salesman_name": "Sumit", "beat_name": "DLF Phase 1" if shop["beat_id"] else None, "outstanding": 500 if shop["id"] == 9 else 0,
              "last_order_at": "2026-11-17T06:00:00Z" if shop["id"] == 9 else None}
             for shop in rows[offset:offset + limit]]
    return {"items": items, "total": len(rows)}


ADMIN_LOOKUPS = {"salesmen": [{"id": 7, "name": "Sumit"}, {"id": 8, "name": "Rahul"}], "beats": [{"id": 1, "name": "DLF Phase 1"}], "retailers": SHOPS}


def session(browser, role, width, height, status):
    sent = []

    def respond(route):
        r = route.request
        path = urlparse(r.url).path
        headers = {"Access-Control-Allow-Origin": BASE, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*"}
        if r.method == "OPTIONS":
            return route.fulfill(status=204, headers=headers)
        if r.method in ("PATCH", "POST"):
            sent.append((r.method, path, json.loads(r.post_data or "{}")))
            return route.fulfill(status=200, content_type="application/json", body=json.dumps({"id": 161}), headers=headers)
        body = {"/auth/me": {"id": 1, "role": role}, "/admin/drivers": [{"id": 3, "name": "Ravi"}], "/orders/161": order(status),
                "/admin/orders": {"items": [ROW], "total": 1, "total_value": 960}, "/orders": {"items": [ROW], "total": 1},
                "/admin/orders/status-summary": {"ALL": 1, "READY_TO_SHIP": 1}, "/admin/lookups": ADMIN_LOOKUPS,
                "/orders/lookups": ORDER_LOOKUPS, "/orders/availability": {"1": 500},
                "/retailers/9": SHOP, "/retailers/beats": BEATS, "/retailers": shops_page(r.url) if path == "/retailers" else None,
                "/admin/salesmen": SALESMEN, "/admin/warehouses": [{"id": 1, "name": "City"}]}.get(path, [])
        route.fulfill(status=200, content_type="application/json", body=json.dumps(body), headers=headers)

    def is_api(route):
        r = route.request
        return r.resource_type in ("fetch", "xhr") and "/_next/" not in r.url and "_rsc=" not in r.url and not r.headers.get("rsc")

    context = browser.new_context(viewport={"width": width, "height": height}, is_mobile=width < 768, has_touch=width < 1024)
    token = base64.urlsafe_b64encode(json.dumps({"user_id": 1, "role": role, "exp": 9999999999}).encode()).decode().rstrip("=")
    context.add_init_script(f"localStorage.setItem('ascend_access_token', 't.{token}.t')")
    context.route("**/*", lambda route: respond(route) if is_api(route) else route.continue_())
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    return context, page, sent, errors


def visit(page, path):
    page.goto(BASE + path)
    page.wait_for_load_state("networkidle")
    page.add_style_tag(content=HIDE_DEV_OVERLAY)
    page.wait_for_timeout(500)


def check_phone(browser, role, width, height):
    status, step_label, step_body = STEP[role]
    context, page, sent, errors = session(browser, role, width, height, status)
    tag = f"{role.lower()}-{width}"

    visit(page, "/app/orders")
    page.locator('a[href="/app/orders/161"]').filter(visible=True).first.click()
    page.wait_for_url("**/app/orders/161")
    page.wait_for_load_state("networkidle")
    assert page.locator(".fixed.inset-0.bg-black\\/30").count() == 0, f"{tag}: the order opened over the list"
    assert page.locator(".field-header").get_by_text("Order details").count() == 1, f"{tag}: no app header"
    page.get_by_text("2 ladi × ₹96.00").first.wait_for()
    page.screenshot(path=str(OUT / f"{tag}-order.png"))

    bar = page.locator(".mobile-action-bar").filter(visible=True).first
    if step_label:
        bar.get_by_role("button", name=step_label).click()
        confirm = page.get_by_role("dialog").get_by_role("button", name=step_label)
        if confirm.count():
            confirm.click()
        page.wait_for_timeout(800)
        patches = [body for method, path, body in sent if method == "PATCH"]
        assert patches and {k: patches[-1][k] for k in step_body} == step_body, f"{tag}: sent {patches}"
    else:
        assert "PDF" in bar.inner_text(), f"{tag}: bar should offer the PDF, got {bar.inner_text()!r}"

    if role == "ADMIN":
        visit(page, "/app/dashboard")
        tabs = page.locator(".field-bottom-nav").inner_text().split()
        assert tabs == ["Home", "Orders", "Retailers", "Finance", "More"], tabs
        page.locator(".field-bottom-nav").get_by_role("button", name="More").click()
        more = page.get_by_role("dialog").inner_text()
        for label in ("Inventory", "Catalog", "Imports", "Admin", "Bill Labels", "Account", "Sign out"):
            assert label in more, f"More is missing {label}"

    if role in ("ADMIN", "SALESMAN"):
        sent.clear()
        visit(page, "/app/orders/new")
        # On touch the pickers are read-only and open their list on a tap.
        page.get_by_role("combobox", name="Search your shops" if role == "SALESMAN" else "Search shops").click()
        page.get_by_role("listbox").get_by_role("option", name="Dear drink").first.dispatch_event("mousedown")
        page.get_by_role("combobox", name="Add a product").click(force=True)
        page.get_by_role("listbox").get_by_role("option").first.dispatch_event("mousedown")
        page.get_by_role("button", name="Create order").filter(visible=True).first.click(force=True)
        page.wait_for_timeout(800)
        posts = [body for method, path, body in sent if method == "POST" and path == "/orders"]
        assert posts, f"{tag}: the order form did not post"
        if role == "ADMIN":
            assert posts[0].get("salesman_id") == 7, f"{tag}: the shop's salesman was not sent: {posts[0]}"
        else:
            assert "salesman_id" not in posts[0], f"{tag}: a salesman's order is stamped by the server"

    if role in ("ADMIN", "ACCOUNTANT", "SALESMAN"):
        sent.clear()
        visit(page, "/app/retailers")
        page.get_by_role("link", name="Map").first.wait_for()
        cards = page.locator("li").filter(has=page.get_by_role("link", name="Map")).filter(visible=True)
        assert cards.count() == 30, f"{tag}: expected the first 30 shops, got {cards.count()}"
        page.screenshot(path=str(OUT / f"{tag}-shops.png"))
        page.get_by_role("button", name="Page 2").click()
        page.get_by_text("Shop 40").wait_for()
        assert cards.count() == 10, f"{tag}: page 2 should hold the last 10 shops, got {cards.count()}"
        page.get_by_role("button", name="Page 1").click()
        page.get_by_text("Dear drink").first.wait_for()
        assert page.get_by_text("Ordered", exact=False).count() and page.get_by_text("No orders yet", exact=False).count(), f"{tag}: last order on cards"
        # Tapping the card itself, outside its name and buttons, opens the shop.
        cards.first.click(position={"x": 4, "y": 4})
        page.wait_for_url("**/app/retailers/9")
        page.go_back()
        page.get_by_role("link", name="Map").first.wait_for()
        if role == "ADMIN":
            assert page.get_by_text("Sumit · DLF Phase 1").count(), "the office should see salesman and beat"
            page.get_by_role("button", name="Edit Dear drink").click()
            page.locator("select").filter(has=page.locator("option", has_text="No beat")).select_option("1")
            page.get_by_role("button", name="Save changes").click()
            page.wait_for_timeout(500)
            assert any(method == "PATCH" and path == "/admin/retailers/9" and body.get("beat_id") == 1 for method, path, body in sent), sent

    if role in ("ADMIN", "ACCOUNTANT", "SALESMAN"):
        visit(page, "/app/retailers")
        page.get_by_role("link", name="Dear drink").first.click()
        page.wait_for_url("**/app/retailers/9")
        page.get_by_role("tab", name="Report").wait_for()
        assert page.get_by_text("₹1,500.00").count(), f"{tag}: the report should show last month"
        page.get_by_role("tab", name="Outstanding").click()
        page.wait_for_url("**/app/retailers/9?tab=outstanding")
        page.screenshot(path=str(OUT / f"{tag}-shop-outstanding.png"))
        page.get_by_role("link", name="Order #161").click()
        page.wait_for_url("**/app/orders/161")
        page.locator(".field-header").get_by_role("button", name="Back").click()
        page.wait_for_url("**/app/retailers/9?tab=outstanding")
        page.get_by_role("tab", name="Orders").click()
        page.locator('a[href="/app/orders/161"]').first.wait_for()

    if role == "ADMIN":
        visit(page, "/app/retailers")
        page.get_by_role("tab", name="Beats").click()
        page.wait_for_url("**/app/retailers?view=beats")
        page.locator('a[href="/app/retailers/beats/1"]').click()
        page.wait_for_url("**/app/retailers/beats/1")
        page.wait_for_load_state("networkidle")
        page.get_by_role("link", name="Map").first.wait_for()
        shops = page.locator("li").filter(has=page.get_by_role("link", name="Map")).filter(visible=True).count()
        assert shops == 20, f"{tag}: the beat should list its 20 shops, got {shops}"
        page.screenshot(path=str(OUT / f"{tag}-beat.png"))
        page.locator(".field-header").get_by_role("button", name="Back").click()
        page.wait_for_url("**/app/retailers?view=beats")

    assert not errors, f"{tag}: page errors {errors}"
    context.close()
    print(f"ok  {tag}", flush=True)


def check_desk(browser):
    context, page, sent, errors = session(browser, "ADMIN", 1440, 900, "READY_TO_SHIP")
    visit(page, "/app/orders")
    page.get_by_text("Dear drink").filter(visible=True).first.click()
    page.locator("aside").filter(has_text="Order #161").first.wait_for()

    visit(page, "/app/retailers")
    tabs = [name.strip() for name in page.get_by_role("tab").all_inner_texts()]
    assert tabs == ["Shops", "Beats"], f"admin-1440: retailers tabs {tabs}"
    table = page.locator("table").first
    headers = [name.strip() for name in table.locator("th").all_inner_texts()]
    assert "Owed" in headers and not {"City", "State", "Pincode"} & set(headers), headers
    assert table.get_by_text("₹500.00").count(), "admin-1440: the shop's owed amount"
    page.get_by_text("1–25 of 40 shops").wait_for()
    page.screenshot(path=str(OUT / "admin-1440-shops.png"))
    page.get_by_role("button", name="Page 2").click()
    page.get_by_text("26–40 of 40 shops").wait_for()
    page.get_by_role("button", name="Page 1").click()
    assert "Last order" in headers, headers
    # Any cell of the row opens the shop; the pencil does not.
    page.locator("tr").filter(has_text="Dear drink").locator("td").nth(3).click()
    page.wait_for_url("**/app/retailers/9")
    page.go_back()
    page.get_by_role("button", name="Edit Dear drink").click()
    dialog = page.locator("dialog")
    dialog.get_by_label("Pincode").wait_for()
    dialog.get_by_label("Beat").select_option("1")
    page.screenshot(path=str(OUT / "admin-1440-edit.png"))
    dialog.get_by_role("button", name="Save changes").click()
    dialog.wait_for(state="hidden")
    assert any(method == "PATCH" and path == "/admin/retailers/9" and body.get("beat_id") == 1 for method, path, body in sent), sent

    page.get_by_role("tab", name="Beats").click()
    beat_row = page.locator("tr").filter(has_text="DLF Phase 1").first
    assert "₹500.00" in beat_row.inner_text(), "admin-1440: the beat's owed amount"
    beat_row.get_by_role("button", name="DLF Phase 1", exact=True).click()
    page.get_by_role("link", name="Dear drink").wait_for()
    page.screenshot(path=str(OUT / "admin-1440-beats.png"))
    page.get_by_role("link", name="Dear drink").click()
    page.wait_for_url("**/app/retailers/9")
    page.get_by_role("button", name="Retailers").click()
    page.wait_for_url("**/app/retailers?tab=beats")
    assert not errors, f"admin-1440: page errors {errors}"
    context.close()
    print("ok  admin-1440", flush=True)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    try:
        for role in STEP:
            for width, height in ((390, 844), (768, 1024)):
                check_phone(browser, role, width, height)
        check_desk(browser)
    finally:
        browser.close()
