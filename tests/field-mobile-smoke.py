"""Browser smoke checks for the field workspace with synthetic, intercepted API data.

Run a local Next server on port 3100, then:
    python tests/field-mobile-smoke.py
Requires Python Playwright and its Chromium browser. FIELD_TEST_URL overrides the URL;
FIELD_SCREENSHOT_DIR controls screenshots. No requests reach the real backend.
"""
import os
from pathlib import Path
import base64
import json
import re
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('FIELD_TEST_URL', 'http://127.0.0.1:3100')
SCREENSHOTS = Path(os.environ.get('FIELD_SCREENSHOT_DIR', '/tmp/ascend-field-review'))
SCREENSHOTS.mkdir(parents=True, exist_ok=True)
retailer = dict(id=1, name='Dev Pan Shop', address_line1='Shop 12, Main Market', address_line2='Near the bus stop', city='Gurgaon', mobile_number=9876543210)
lookup = dict(retailers=[retailer], warehouses=[dict(id=1, name='Gurgaon Warehouse', state='Haryana')], brands=[dict(id=1, name='Jabsons')], skus=[dict(id=1, name='Roasted Peanuts', brand_id=1, mrp=10, selling_price=10, gst_rate=5)], drivers=[dict(id=1, name='Ravi')])
orders = [dict(id=i, retailer_name=retailer['name'], to_entity_id=1, from_entity_id=1, status=status, can_collect_cash=True, total_amount=1260, grand_total=1260, pending_amount=1260, created_at='2026-10-15T06:00:00Z', items=[], trails=[], payments=[], credit_notes=[]) for i,status in [(101,'READY_TO_SHIP'),(102,'OUT_FOR_DELIVERY'),(103,'DELIVERED')]]
mutations=[]
cash_results={}
cash_attempts=[]
lose_cash_response=False

def route_api(route):
    req = route.request
    url=urlparse(req.url); path=url.path; query=parse_qs(url.query)
    if req.method == 'OPTIONS':
        route.fulfill(status=204, headers={'Access-Control-Allow-Origin':BASE,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'}); return
    if req.method == 'POST' and path.endswith('/cash-collections'):
        body=req.post_data_json
        cash_attempts.append(body)
        key=body['collection_id']
        order=next(o for o in orders if o['id']==int(path.split('/')[-2]))
        if key not in cash_results:
            amount=float(body['amount'])
            result={'id':len(cash_results)+1,'amount':amount,'payment_mode':'CASH','transaction_reference':'SALESMAN-CASH-'+key,'created_at':'2026-10-15T08:00:00Z'}
            cash_results[key]=result
            order['pending_amount']-=amount
            order['payment_status']='PAID' if order['pending_amount']==0 else 'PARTIAL'
            order['can_collect_cash']=order['pending_amount']>0
            order['payments']=[*order.get('payments',[]),result]
            if lose_cash_response:
                route.abort('failed'); return
        route.fulfill(status=200, content_type='application/json',body=json.dumps(cash_results[key]),headers={'Access-Control-Allow-Origin':BASE,'Access-Control-Allow-Credentials':'true'})
        return
    if req.method in ('POST','PATCH'):
        body=req.post_data_json; mutations.append((path,body))
        if path.endswith('/status'):
            oid=int(path.split('/')[-2]); next(o for o in orders if o['id']==oid)['status']=body['status']
        result=dict(orders[0], id=104) if path == '/orders' else {}
    elif path in ('/orders/lookups','/admin/lookups'): result=lookup
    elif path in ('/orders','/admin/orders'):
        status=query.get('status',[None])[0]; selected=[o for o in orders if status is None or o['status']==status]
        offset=int(query.get('offset',[0])[0]); limit=int(query.get('limit',[50])[0])
        result={'items':selected[offset:offset+limit], 'total':len(selected)}
    elif path=='/admin/orders/status-summary': result={'PENDING':3,'READY_TO_SHIP':2,'OUT_FOR_DELIVERY':1}
    elif path.startswith('/orders/') and path.split('/')[-1].isdigit(): result=next((o for o in orders if o['id']==int(path.split('/')[-1])),dict(orders[0],id=int(path.split('/')[-1])))
    elif path=='/auth/me': result={'id':1,'email':'field@example.com','role':'SALESMAN'}
    elif 'availability' in path: result={'available':{'1':100}}
    elif path=='/admin/drivers': result=lookup['drivers']
    else: result=[]
    route.fulfill(status=200, content_type='application/json', body=json.dumps(result), headers={'Access-Control-Allow-Origin':BASE,'Access-Control-Allow-Credentials':'true'})

def session(browser, role, width=390):
    context=browser.new_context(viewport={'width':width,'height':844}, is_mobile=width<768, has_touch=width<1024, geolocation={'latitude':28.45,'longitude':77.03}, permissions=['geolocation'])
    payload=base64.urlsafe_b64encode(json.dumps({'user_id':1,'email':'field@example.com','role':role,'exp':9999999999}).encode()).decode().rstrip('=')
    context.add_init_script(f"localStorage.setItem('ascend_access_token', 'test.{payload}.test')")
    context.route('**/*', lambda route: route_api(route) if route.request.resource_type in ('fetch', 'xhr') and not '/_next/' in route.request.url and not '_rsc=' in route.request.url and not route.request.headers.get('rsc') else route.continue_())
    return context, context.new_page()

def visit(page, path):
    page.goto(BASE+path)
    page.wait_for_load_state('networkidle')
    page.add_style_tag(content='nextjs-portal { display: none !important; }')
    expect(page.locator('.field-bottom-nav')).to_be_visible()

def no_overflow(page):
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'Horizontal page overflow'

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    for role in ('SALESMAN','DRIVER','WAREHOUSE_MANAGER'):
        context,page=session(browser,role)
        errors=[]; page.on('pageerror',lambda error: errors.append(str(error)))
        visit(page,'/app/dashboard')
        expect(page.locator('.field-home')).to_be_visible()
        expect(page.locator('.field-nav-item[aria-current="page"]')).to_have_text('Home')
        no_overflow(page)
        page.screenshot(path=str(SCREENSHOTS / f'{role.lower()}-home.png'),full_page=False)
        page.locator('.field-bottom-nav a[href="/app/orders"]').click()
        page.wait_for_load_state('networkidle')
        expect(page.locator('.field-status-filters')).to_be_visible()
        no_overflow(page)
        page.screenshot(path=str(SCREENSHOTS / f'{role.lower()}-orders.png'),full_page=False)
        if role=='DRIVER':
            page.get_by_role('button',name='Mark In Transit',exact=True).click()
            expect(page.locator('.field-order-card')).to_have_count(0)
            page.get_by_role('button',name='On the road',exact=True).click()
            expect(page.locator('.field-order-card')).to_have_count(2)
            card=page.locator('.field-order-card').first
            card.get_by_role('combobox').first.select_option('PARTIAL')
            card.get_by_role('combobox').nth(1).select_option('CASH')
            card.get_by_placeholder('Amount').fill('1000')
            card.get_by_role('button',name='Mark Delivered',exact=True).click()
            expect(page.locator('.field-order-card')).to_have_count(1)
            assert any(body.get('status')=='DELIVERED' and body.get('payment_amount')==1000 and 'latitude' in body for _,body in mutations)
        if role=='WAREHOUSE_MANAGER':
            page.get_by_role('button',name='All orders',exact=True).click()
            page.wait_for_load_state('networkidle')
            page.screenshot(path=str(SCREENSHOTS / 'warehouse_manager-orders.png'),full_page=False)
        if role=='SALESMAN':
            visit(page,'/app/orders/new')
            expect(page.locator('.field-nav-item[aria-current="page"]')).to_have_text('Orders')
            no_overflow(page)
            action=page.locator('.mobile-action-bar').bounding_box(); nav=page.locator('.field-bottom-nav').bounding_box()
            assert action['y']+action['height'] <= nav['y']+1, 'Action bar overlaps navigation'
            page.get_by_role('combobox',name=re.compile('Search retailers')).fill('Main Market')
            expect(page.get_by_role('option',name='Dev Pan Shop')).to_contain_text('Shop 12, Main Market')
            page.get_by_role('option',name='Dev Pan Shop').click()
            page.locator('select').nth(0).select_option('1')
            page.locator('select').nth(1).select_option('1')
            page.locator('select').nth(2).select_option('CREDIT')
            page.get_by_role('combobox',name=re.compile('Search SKUs')).first.fill('Peanuts')
            page.get_by_role('option',name='Roasted Peanuts').click()
            page.get_by_role('spinbutton',name='Quantity for line 1').filter(visible=True).fill('12')
            page.screenshot(path=str(SCREENSHOTS / 'salesman-order-entry.png'),full_page=False)
            page.locator('.mobile-action-bar').get_by_role('button',name='Create order',exact=True).click()
            page.wait_for_url('**/app/orders/104')
            assert any(path=='/orders' and body['retailer_id']==1 for path,body in mutations)
            visit(page,'/app/orders/101')
            expect(page.get_by_role('heading',name='Record collected cash')).to_be_visible()
            page.get_by_label('Cash collected (₹)').fill('120.00')
            lose_cash_response=True
            page.get_by_role('button',name='Record cash payment',exact=True).click()
            expect(page.get_by_role('button',name='Retry collection',exact=True)).to_be_visible()
            expect(page.get_by_label('Cash collected (₹)')).to_have_attribute('readonly','')
            page.get_by_role('button',name='Retry collection',exact=True).click()
            expect(page.get_by_text('Cash recorded. The order balance has been updated.')).to_be_visible()
            assert len(cash_results)==1 and len(cash_attempts)==2
            assert cash_attempts[0]['collection_id']==cash_attempts[1]['collection_id']
            assert orders[0]['pending_amount']==1140
            page.wait_for_load_state('networkidle')
            page.screenshot(path=str(SCREENSHOTS / 'salesman-cash.png'),full_page=False)

        visit(page,'/app/profile')
        expect(page.get_by_role('button',name='Sign out',exact=True)).to_be_visible()
        no_overflow(page)
        assert not errors, errors
        context.close()
        print(role, 'mobile workflows passed')
    for width in (320,768,1024,1440):
        context,page=session(browser,'SALESMAN',width)
        page.goto(BASE+'/app/dashboard'); page.wait_for_load_state('networkidle')
        if width<1024: expect(page.locator('.field-bottom-nav')).to_be_visible()
        else:
            expect(page.locator('.field-bottom-nav')).to_be_hidden()
            expect(page.locator('.app-shell > aside')).to_be_visible()
        no_overflow(page)
        if width < 1024:
            visit(page,'/app/orders/new')
            no_overflow(page)
        page.screenshot(path=str(SCREENSHOTS / f'salesman-{width}.png'),full_page=False)
        context.close()
        print(width,'layout passed')
    browser.close()
