"""Retailers workspace browser smoke checks using synthetic, intercepted backend data.

Start a production Next server on port 3200, then run:
    python tests/retailer-workspace-smoke.py
Requires Python Playwright with Chromium. RETAILER_TEST_URL and RETAILER_SCREENSHOT_DIR
can override the local server and screenshot directory. No real backend writes occur.
"""
import base64,json,os
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright,expect

BASE=os.environ.get('RETAILER_TEST_URL','http://127.0.0.1:3200')
SCREENSHOTS=Path(os.environ.get('RETAILER_SCREENSHOT_DIR','/tmp/ascend-retailer-hub'))
SCREENSHOTS.mkdir(parents=True,exist_ok=True)
retailers=[dict(id=1,name='Dev Pan Shop',mobile_number=9876543210,address_line1='Main Market',address_line2=None,city='Gurgaon',state='Haryana',pincode=122001,gst_number=None,assigned_salesman_id=1,beat_id=1,created_at='2026-10-14T12:00:00Z'),dict(id=2,name='New Corner Store',mobile_number=9876543211,address_line1='MG Road',address_line2=None,city='Gurgaon',state='Haryana',pincode=122001,gst_number=None,assigned_salesman_id=1,beat_id=1,created_at='2026-10-15T12:00:00Z')]
lookups=dict(retailers=retailers,beats=[dict(id=1,name='Market Beat',warehouse_id=1)],warehouses=[dict(id=1,name='Gurgaon Warehouse',state='Haryana')],salesmen=[dict(id=1,name='Ravi')],warehouse_managers=[],drivers=[],brands=[],skus=[])
requests=[dict(id=1,name='Pending Shop',status='PENDING',requested_by_employee_id=1,requested_by_name='Ravi',mobile_number=9876543212,address_line1='Station Road',city='Gurgaon')]
mutations=[]

def api(route):
    req=route.request;path=urlparse(req.url).path;query=parse_qs(urlparse(req.url).query)
    if req.method=='OPTIONS':
        route.fulfill(status=204,headers={'Access-Control-Allow-Origin':BASE,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'});return
    if req.method in ('POST','PATCH'):
        data=req.post_data_json;mutations.append((path,data))
        if '/approve' in path:
            requests[0]['status']='APPROVED';result=requests[0]
            retailers.append(dict(retailers[0],id=3,name='Pending Shop'))
        elif path=='/admin/beats':
            result=dict(data,id=2);lookups['beats'].append(result)
        elif path.startswith('/admin/retailers/'):
            result=next(row for row in retailers if row['id']==int(path.split('/')[-1]));result.update(data)
        else: result=dict(data,id=4);retailers.append(result)
    elif path in ('/admin/lookups','/orders/lookups'):result=lookups
    elif path=='/retailer-requests':
        status=query.get('status',[None])[0];result=[row for row in requests if status is None or row['status']==status]
    elif path=='/dashboard/coverage':result={'planned':2,'billed':1,'coverage_percent':50,'retailers_without_beat':0}
    elif path=='/accounting/outstanding/summary':result={'total_outstanding':100,'total_recovered':50,'aging':{},'by_salesman':[],'by_retailer':[]}
    elif path.startswith('/accounting/') or path in ('/orders','/admin/orders'):result={'items':[],'total':0,'daily_totals':[]}
    else:result=[]
    route.fulfill(status=200,content_type='application/json',body=json.dumps(result),headers={'Access-Control-Allow-Origin':BASE,'Access-Control-Allow-Credentials':'true'})

def session(browser,role,width=1440):
    context=browser.new_context(viewport={'width':width,'height':1000})
    token=base64.urlsafe_b64encode(json.dumps({'user_id':1,'email':'test@example.com','role':role,'exp':9999999999}).encode()).decode().rstrip('=')
    context.add_init_script(f"localStorage.setItem('ascend_access_token','test.{token}.test')")
    context.route('http://localhost:8000/**',api)
    page=context.new_page();page.set_default_timeout(120000);page.set_default_navigation_timeout(600000)
    return context,page

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    context,page=session(browser,'ADMIN')
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE+'/app/retailers');page.wait_for_load_state('networkidle')
    expect(page.get_by_role('heading',name='Retailers',exact=True).first).to_be_visible()
    assert 'New Corner Store' in page.locator('table tbody tr').first.inner_text()
    expect(page.locator('aside').get_by_role('link',name='Retailers',exact=True)).to_have_count(1)
    expect(page.locator('aside').get_by_role('link',name='Retailer Requests',exact=True)).to_have_count(0)
    page.get_by_role('button',name='Edit New Corner Store',exact=True).click()
    page.locator('table').get_by_label('Retailer name',exact=True).fill('Updated Corner Store')
    page.get_by_role('button',name='Save row',exact=True).click()
    expect(page.get_by_role('button',name='Edit Updated Corner Store',exact=True)).to_be_visible()
    assert any(path=='/admin/retailers/2' and data['name']=='Updated Corner Store' for path,data in mutations)
    page.get_by_role('button',name='+ Add retailer',exact=True).click()
    page.locator('table').get_by_label('Retailer name',exact=True).fill('Added Retailer')
    page.locator('table').get_by_label('State',exact=True).select_option('Haryana')
    page.get_by_role('button',name='Save row',exact=True).click()
    expect(page.get_by_role('button',name='Edit Added Retailer',exact=True)).to_be_visible()
    assert any(path=='/admin/retailers' and data['name']=='Added Retailer' for path,data in mutations)
    page.get_by_role('button',name='Requests',exact=True).click()
    expect(page.get_by_text('Pending Shop',exact=True)).to_be_visible()
    page.get_by_role('button',name='Approve',exact=True).click()
    expect(page.get_by_text('Nothing waiting for review.',exact=True)).to_be_visible()
    page.get_by_role('button',name='Directory',exact=True).click()
    expect(page.get_by_role('button',name='Edit Pending Shop',exact=True)).to_be_visible()
    page.get_by_role('button',name='Beats',exact=True).click()
    expect(page.get_by_role('heading',name='Retailer beats',exact=True)).to_be_visible()
    expect(page.locator('table').get_by_text('Market Beat',exact=True)).to_be_visible()
    page.get_by_label('Beat name',exact=True).fill('New Beat')
    page.get_by_role('button',name='Create Beat',exact=True).click()
    expect(page.locator('table').get_by_text('New Beat',exact=True)).to_be_visible()
    page.get_by_role('button',name='Coverage',exact=True).click()
    expect(page.get_by_role('heading',name='Retail Coverage',exact=True)).to_be_visible()
    page.get_by_role('button',name='Outstanding',exact=True).click()
    expect(page.get_by_role('heading',name='Outstanding Orders',exact=True)).to_be_visible()
    page.get_by_role('button',name='Collections',exact=True).click()
    expect(page.get_by_role('heading',name='Payment log',exact=True)).to_be_visible()
    for old,new in [
      ('/app/master-data?tab=retailers','directory'),('/app/retailer-requests','requests'),
      ('/app/operations?tab=coverage','coverage'),('/app/finance?tab=outstanding','outstanding'),('/app/finance?tab=collection','collections')]:
        page.goto(BASE+old);page.wait_for_url(BASE+'/app/retailers?tab='+new)
        page.wait_for_load_state('networkidle')
    page.goto(BASE+'/app/master-data?tab=brands');page.wait_for_load_state('networkidle')
    expect(page.get_by_role('button',name='Retailers',exact=True)).to_have_count(0)
    page.goto(BASE+'/app/operations?tab=drivers');page.wait_for_load_state('networkidle')
    expect(page.get_by_role('button',name='Coverage',exact=True)).to_have_count(0)
    page.goto(BASE+'/app/retailers?tab=directory');page.wait_for_load_state('networkidle')
    page.screenshot(path=str(SCREENSHOTS/'admin-directory.png'),full_page=True)
    assert not errors,errors
    context.close()
    print('Admin: six tabs, edits, creation, approval, beat setup and legacy redirects passed.',flush=True)
    context,page=session(browser,'ACCOUNTANT')
    page.goto(BASE+'/app/retailers');page.wait_for_load_state('networkidle')
    expect(page.get_by_role('button',name='Outstanding',exact=True)).to_be_visible()
    expect(page.get_by_role('button',name='Collections',exact=True)).to_be_visible()
    for label in ('Directory','Requests','Beats','Coverage'):
        expect(page.get_by_role('button',name=label,exact=True)).to_have_count(0)
    page.goto(BASE+'/app/retailers?tab=directory');page.wait_for_url(BASE+'/app/retailers?tab=outstanding')
    context.close()
    print('Accountant: existing finance access retained; admin tabs inaccessible.',flush=True)
    context,page=session(browser,'SALESMAN',390)
    page.goto(BASE+'/app/retailers');page.wait_for_load_state('networkidle')
    expect(page.get_by_role('heading',name='My Retailers',exact=True)).to_be_visible()
    expect(page.get_by_role('button',name='Directory',exact=True)).to_have_count(0)
    expect(page.locator('.field-bottom-nav')).to_be_visible()
    context.close();browser.close()
    print('Salesman: assigned-retailer view and mobile navigation retained.',flush=True)
