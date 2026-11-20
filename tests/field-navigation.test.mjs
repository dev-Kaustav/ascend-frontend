import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getChildScreen, getFieldNavForRole, getMoreNavForRole, getNavForRole, isFieldRole, usesAppShell } from '../lib/navigation.js';
import { getWorkspaceRuleForPath } from '../lib/workspaceRoutes.js';

for (const role of ['SALESMAN', 'DRIVER', 'WAREHOUSE_MANAGER']) {
  test(`${role} has reachable field tabs including an accessible account`, () => {
    const tabs = getFieldNavForRole(role);
    assert.equal(isFieldRole(role), true);
    assert.ok(tabs.length >= 3 && tabs.length <= 5);
    assert.equal(tabs[0].label, 'Home');
    assert.equal(tabs.at(-1).href, '/app/profile');
    assert.equal(new Set(tabs.map(tab => tab.href)).size, tabs.length);
    assert.deepEqual(tabs.slice(0, -1).map(tab => tab.href), getNavForRole(role).map(tab => tab.href));
    for (const tab of tabs) assert.ok(getWorkspaceRuleForPath(tab.href)?.roles.includes(role), `${role} cannot access ${tab.href}`);
    assert.ok(getWorkspaceRuleForPath('/app/orders/101').roles.includes(role));
  });
}

for (const role of ['ADMIN', 'ACCOUNTANT']) {
  test(`${role} gets the app shell: four tabs, then More with the rest and the account`, () => {
    assert.equal(usesAppShell(role), true);
    const tabs = getFieldNavForRole(role);
    assert.deepEqual(tabs.map(tab => tab.label), ['Home', 'Orders', 'Retailers', 'Finance', 'More']);
    assert.equal(tabs.at(-1).href, null);
    const more = getMoreNavForRole(role);
    assert.equal(more.at(-1).href, '/app/profile');
    // Every section of the role is reachable from a tab or from More, and only once.
    const reachable = [...tabs, ...more].map(item => item.href).filter(Boolean);
    assert.equal(new Set(reachable).size, reachable.length);
    for (const item of getNavForRole(role)) assert.ok(reachable.includes(item.href), `${role} cannot reach ${item.href}`);
  });
}

test('brand and store roles keep their existing shell', () => {
  for (const role of ['BRAND', 'RETAILER', null]) {
    assert.equal(usesAppShell(role), false);
    assert.deepEqual(getFieldNavForRole(role), []);
    assert.deepEqual(getMoreNavForRole(role), []);
  }
});

test('drivers cannot enter order creation from a nested orders route', () => {
  assert.equal(getWorkspaceRuleForPath('/app/orders/new').roles.includes('DRIVER'), false);
  assert.equal(getWorkspaceRuleForPath('/app/orders/new').roles.includes('SALESMAN'), true);
});

test('screens below a tab get a title and a parent for the back arrow', () => {
  assert.deepEqual(getChildScreen('/app/orders/new'), { prefix: '/app/orders/new', title: 'New order', parent: '/app/orders' });
  assert.equal(getChildScreen('/app/orders/161').title, 'Order details');
  assert.equal(getChildScreen('/app/retailers/beats/none').parent, '/app/retailers?view=beats');
  assert.equal(getChildScreen('/app/retailers/9').title, 'Shop');
  assert.equal(getChildScreen('/app/retailers'), null);
  assert.ok(getWorkspaceRuleForPath('/app/retailers/beats/1').roles.every(role => role === 'ADMIN'));
  assert.ok(getWorkspaceRuleForPath('/app/retailers/9').roles.includes('SALESMAN'));
});
