import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getFieldNavForRole, getNavForRole, isFieldRole } from '../lib/navigation.js';
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

test('office and store roles retain their existing shell', () => {
  for (const role of ['ADMIN', 'ACCOUNTANT', 'BRAND', 'RETAILER', null]) {
    assert.equal(isFieldRole(role), false);
    assert.deepEqual(getFieldNavForRole(role), []);
  }
});

test('drivers cannot enter order creation from a nested orders route', () => {
  assert.equal(getWorkspaceRuleForPath('/app/orders/new').roles.includes('DRIVER'), false);
  assert.equal(getWorkspaceRuleForPath('/app/orders/new').roles.includes('SALESMAN'), true);
});
