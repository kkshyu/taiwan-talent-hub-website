import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {
  POINT_PRICE_TWD, PACKS, MEMBERSHIP_GIFT_POINTS, REDEEM_PRICES,
  addYears, isLotAvailable, availableBalance, sortLotsForDebit,
  planDebit, planRefund, redeemPointsFor,
} = require('../lib/points.js');

const t0 = new Date('2026-07-12T00:00:00.000Z');

test('packs and gifts match spec', () => {
  assert.equal(POINT_PRICE_TWD, 1);
  assert.equal(PACKS.mid.principal, 1000);
  assert.equal(PACKS.mid.bonus, 100);
  assert.equal(PACKS.mid.pay_twd, 1000);
  assert.equal(MEMBERSHIP_GIFT_POINTS.month, 1000);
  assert.equal(MEMBERSHIP_GIFT_POINTS.founding, 20000);
  assert.equal(MEMBERSHIP_GIFT_POINTS.day_4h, 0);
  assert.equal(REDEEM_PRICES.shower, 70);
  assert.equal(REDEEM_PRICES.capsule_per_hour, 100);
  assert.equal(REDEEM_PRICES.entertainment_per_hour, 100);
  assert.equal(REDEEM_PRICES.laundry, 50);
});

test('addYears is +1 calendar year UTC', () => {
  assert.equal(addYears(t0, 1).toISOString(), '2027-07-12T00:00:00.000Z');
});

test('availableBalance ignores expired and zero remaining', () => {
  const lots = [
    { id: 'a', remaining: 50, expires_at: null },
    { id: 'b', remaining: 10, expires_at: new Date('2026-01-01T00:00:00.000Z') },
    { id: 'c', remaining: 5, expires_at: new Date('2027-01-01T00:00:00.000Z') },
  ];
  assert.equal(availableBalance(lots, t0), 55);
  assert.equal(isLotAvailable(lots[1], t0), false);
});

test('sortLotsForDebit nearest expiry first, null last', () => {
  const lots = [
    { id: 'p', remaining: 10, expires_at: null, created_at: t0 },
    { id: 'g2', remaining: 10, expires_at: new Date('2027-12-01T00:00:00.000Z'), created_at: t0 },
    { id: 'g1', remaining: 10, expires_at: new Date('2027-01-01T00:00:00.000Z'), created_at: t0 },
  ];
  assert.deepEqual(sortLotsForDebit(lots).map(l => l.id), ['g1', 'g2', 'p']);
});

test('redeemPointsFor maps services', () => {
  assert.equal(redeemPointsFor('shower', 1), 70);
  assert.equal(redeemPointsFor('capsule', 2), 200);
  assert.equal(redeemPointsFor('entertainment', 1), 100);
  assert.throws(() => redeemPointsFor('venue', 1));
});

test('planDebit spends nearest expiry first', () => {
  const lots = [
    { id: 'p', type: 'purchase', remaining: 100, expires_at: null, created_at: t0 },
    { id: 'g', type: 'bonus', remaining: 10, expires_at: new Date('2027-01-01T00:00:00.000Z'), created_at: t0 },
  ];
  const plan = planDebit(lots, 15, t0);
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.allocations, [
    { lot_id: 'g', amount: 10 },
    { lot_id: 'p', amount: 5 },
  ]);
});

test('planDebit fails when insufficient', () => {
  const lots = [{ id: 'p', remaining: 3, expires_at: null, created_at: t0 }];
  assert.equal(planDebit(lots, 7, t0).ok, false);
});

test('planRefund voids all remaining bonus on that order', () => {
  const lots = [
    { id: 'p1', type: 'purchase', source_id: 'ord1', remaining: 60, expires_at: null },
    { id: 'b1', type: 'bonus', source_id: 'ord1', remaining: 8, expires_at: new Date('2027-07-01T00:00:00.000Z') },
    { id: 'g', type: 'membership_gift', source_id: 'c1', remaining: 100, expires_at: new Date('2027-07-01T00:00:00.000Z') },
  ];
  const r = planRefund(lots, 'ord1', 30);
  assert.equal(r.ok, true);
  assert.deepEqual(r.debit_principal, [{ lot_id: 'p1', amount: 30 }]);
  assert.deepEqual(r.void_bonus, [{ lot_id: 'b1', amount: 8 }]);
  assert.equal(r.refund_twd, 30);
  assert.ok(!r.void_bonus.find(x => x.lot_id === 'g'));
});

test('planRefund rejects over principal remaining', () => {
  const lots = [
    { id: 'p1', type: 'purchase', source_id: 'ord1', remaining: 10, expires_at: null },
  ];
  assert.equal(planRefund(lots, 'ord1', 11).ok, false);
});
