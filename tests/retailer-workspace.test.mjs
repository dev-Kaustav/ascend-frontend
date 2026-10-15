import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getNavForRole } from '../lib/navigation.js';
import { getWorkspaceRuleForPath } from '../lib/workspaceRoutes.js';
import nextConfig from '../next.config.mjs';

test('retailer management has one admin sidebar destination', () => {
  const nav = getNavForRole('ADMIN');
  assert.equal(nav.filter(item => item.href === '/app/retailers').length, 1);
  assert.equal(nav.find(item => item.href === '/app/retailers').label, 'Retailers');
  assert.equal(nav.some(item => item.href === '/app/retailer-requests'), false);
});

test('accountants retain retailer finance access and salesmen retain their own retailer route', () => {
  const roles = getWorkspaceRuleForPath('/app/retailers').roles;
  for (const role of ['ADMIN', 'ACCOUNTANT', 'SALESMAN']) {
    assert.ok(roles.includes(role));
    assert.ok(getNavForRole(role).some(item => item.href === '/app/retailers'));
  }
  for (const role of ['DRIVER', 'WAREHOUSE_MANAGER', 'BRAND']) assert.equal(roles.includes(role), false);
  assert.equal(getNavForRole('SALESMAN').find(item => item.href === '/app/retailers').label, 'My Retailers');
});

test('old retailer tab URLs redirect to their matching consolidated tabs', async () => {
  const rules = await nextConfig.redirects();
  const expected = [
    ['/app/master-data', 'retailers', '/app/retailers?tab=directory'],
    ['/app/operations', 'coverage', '/app/retailers?tab=coverage'],
    ['/app/finance', 'outstanding', '/app/retailers?tab=outstanding'],
    ['/app/finance', 'collection', '/app/retailers?tab=collections']
  ];
  assert.equal(rules.length, expected.length);
  for (const [source, value, destination] of expected) {
    const rule = rules.find(item => item.source === source && item.has?.some(condition => condition.type === 'query' && condition.key === 'tab' && condition.value === value));
    assert.ok(rule, `${source}?tab=${value} needs a redirect`);
    assert.equal(rule.destination, destination);
    assert.equal(rule.permanent, false);
  }
});
