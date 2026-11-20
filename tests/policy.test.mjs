import assert from 'node:assert/strict';
import { test } from 'node:test';
import { can, nextStep, needsRiderList } from '../lib/policy.js';

// Who can move an order on, and who can cancel it, from each status. Mirrors _ALLOWED_TRANSITIONS
// in ascend-backend/app/services/order.py (ADMIN may do every listed move).
const ADVANCE = {
  PENDING: ['ADMIN', 'WAREHOUSE_MANAGER'],
  READY_TO_SHIP: ['ADMIN', 'WAREHOUSE_MANAGER'],
  OUT_FOR_DELIVERY: ['ADMIN', 'DRIVER'],
  DELIVERED: [],
  CANCELLED: [],
};
const CANCEL = {
  PENDING: ['ADMIN', 'RETAILER'],
  READY_TO_SHIP: ['ADMIN', 'WAREHOUSE_MANAGER', 'RETAILER'],
  OUT_FOR_DELIVERY: ['ADMIN', 'DRIVER'],
  DELIVERED: [],
  CANCELLED: [],
};
const ROLES = ['ADMIN', 'ACCOUNTANT', 'WAREHOUSE_MANAGER', 'SALESMAN', 'DRIVER', 'RETAILER', 'BRAND', null];

for (const status of Object.keys(ADVANCE)) {
  test(`who may advance or cancel a ${status} order`, () => {
    const order = { status };
    for (const role of ROLES) {
      assert.equal(can(role, 'advance', order), ADVANCE[status].includes(role), `${role} advance ${status}`);
      assert.equal(can(role, 'cancel', order), CANCEL[status].includes(role), `${role} cancel ${status}`);
      assert.equal(Boolean(nextStep(role, order)), ADVANCE[status].includes(role));
    }
  });
}

test('sending out needs a rider, delivering takes the payment', () => {
  assert.equal(nextStep('ADMIN', { status: 'READY_TO_SHIP' }).needs, 'rider');
  assert.equal(nextStep('DRIVER', { status: 'OUT_FOR_DELIVERY' }).needs, 'payment');
  assert.deepEqual(ROLES.filter(needsRiderList), ['ADMIN', 'WAREHOUSE_MANAGER']);
});

test('the order PDF: the office and salesmen, never for an order cancelled before dispatch', () => {
  const open = { status: 'PENDING' };
  assert.deepEqual(ROLES.filter((role) => can(role, 'downloadPdf', open)), ['ADMIN', 'ACCOUNTANT', 'WAREHOUSE_MANAGER', 'SALESMAN']);
  assert.equal(can('ADMIN', 'downloadPdf', { status: 'CANCELLED' }), false);
  assert.equal(can('ADMIN', 'downloadPdf', { status: 'CANCELLED', invoice_number: 'INV-1' }), true);
});

test('booking orders: the office picks the salesman, a salesman is the salesman', () => {
  assert.deepEqual(ROLES.filter((role) => can(role, 'createOrder')), ['ADMIN', 'ACCOUNTANT', 'SALESMAN']);
  assert.deepEqual(ROLES.filter((role) => can(role, 'pickSalesman')), ['ADMIN', 'ACCOUNTANT']);
});

test('cash collection follows the server flag, and only for a salesman', () => {
  assert.equal(can('SALESMAN', 'collectCash', { can_collect_cash: true }), true);
  assert.equal(can('SALESMAN', 'collectCash', { can_collect_cash: false }), false);
  assert.equal(can('ADMIN', 'collectCash', { can_collect_cash: true }), false);
});

test('shops: the office manages them, a salesman adds through requests, the office sees what shops owe', () => {
  assert.deepEqual(ROLES.filter((role) => can(role, 'addRetailer')), ['ADMIN', 'SALESMAN']);
  assert.deepEqual(ROLES.filter((role) => can(role, 'manageRetailers')), ['ADMIN']);
  assert.deepEqual(ROLES.filter((role) => can(role, 'seeOutstanding')), ['ADMIN', 'ACCOUNTANT']);
  assert.deepEqual(ROLES.filter((role) => can(role, 'orderDesk')), ['ADMIN', 'ACCOUNTANT', 'WAREHOUSE_MANAGER']);
});
