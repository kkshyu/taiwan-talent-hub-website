// scripts/test-member-ui.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {
  EXPIRING_WITHIN_DAYS,
  pickNextEvent,
  expiringPointsSummary,
  membershipStatusTitle,
} = require('../lib/member-ui.js');

const now = new Date('2026-07-12T12:00:00.000Z');

for (const page of ['member.html', 'en/member.html', 'ja/member.html']) {
  test(`${page}: paid return remains retryable until fulfillment succeeds`, async () => {
    const html = fs.readFileSync(new URL('../public/' + page, import.meta.url), 'utf8');
    const start = html.indexOf('  async function fulfillPointsIfNeeded()');
    const end = html.indexOf('  async function regEvent(', start);
    assert.ok(start >= 0 && end > start);
    const changedUrls = [];
    let response;
    const context = {
      URLSearchParams, token: 'member-token', FELLOW: '', T: { opFail: 'retry' },
      location: { pathname: '/' + page.replace('.html', ''), search: '?points_paid=1&oid=po_test&s=cs_test&keep=1', hash: '#points' },
      history: { replaceState: (_state, _title, url) => changedUrls.push(url) },
      fetch: async (url, options) => {
        assert.equal(url, '/api/me/points/orders/po_test/fulfill');
        assert.equal(options.headers.authorization, 'Bearer member-token');
        assert.deepEqual(JSON.parse(options.body), { session_id: 'cs_test' });
        if (response instanceof Error) throw response;
        return response;
      },
    };
    const run = () => vm.runInNewContext(html.slice(start, end) + '\nfulfillPointsIfNeeded()', context);
    for (const failure of [
      { ok: false, json: async () => ({ error: 'temporary failure' }) },
      { ok: true, json: async () => ({}) },
      { ok: true, json: async () => { throw new Error('invalid response'); } },
      new Error('network failure'),
    ]) {
      response = failure;
      await assert.rejects(run);
      assert.deepEqual(changedUrls, []);
    }
    response = { ok: true, json: async () => ({ ok: true, already: true }) };
    await run();
    assert.deepEqual(changedUrls, [context.location.pathname + '?keep=1#points']);

    changedUrls.length = 0;
    response = { ok: false, status: 401, json: async () => ({ error: 'sign in again' }) };
    let loginReturn;
    const removed = [];
    Object.assign(context, {
      KEY: 'tth_token', MEMBER_PATH: context.location.pathname, card: {}, stopQrRefresh() {},
      localStorage: { removeItem: key => removed.push(key) },
      loginBtn: redirect => { loginReturn = redirect; return 'Sign in'; },
    });
    context.location.origin = 'https://www.emoji.tw';
    const loggedOut = html.slice(html.indexOf('  function renderLoggedOut()'), html.indexOf('  function renderFoundingLine('));
    const main = html.slice(html.indexOf('  async function main()'), html.indexOf("  document.addEventListener('visibilitychange'"));
    await vm.runInNewContext(html.slice(start, end) + loggedOut + main + '\nmain()', context);
    assert.deepEqual(removed, ['tth_token', 'tth_name']);
    assert.deepEqual(changedUrls, []);
    assert.equal(loginReturn, context.location.origin + context.location.pathname + context.location.search);

    context.location.hash = '#token=new-token';
    let savedToken;
    context.localStorage = { setItem: (_key, value) => { savedToken = value; }, getItem: () => savedToken };
    const callback = html.slice(html.indexOf('  const hash = new URLSearchParams'), html.indexOf('  const loginBtn ='));
    vm.runInNewContext(callback, { ...context, token: undefined });
    assert.equal(savedToken, 'new-token');
    assert.deepEqual(changedUrls, [context.location.pathname + context.location.search]);
  });

  test(`${page}: a pending full refund remains actionable with zero points`, async () => {
    const html = fs.readFileSync(new URL('../public/' + page, import.meta.url), 'utf8');
    const render = html.slice(html.indexOf('  function renderPoints('), html.indexOf('  function renderLoggedOut('));
    const data = {
      points: { balance: 0, lots: [{ type: 'purchase', source_id: 'po_test', remaining: 0 }] },
      point_orders: [{ id: 'po_test', pack_id: 'small', status: 'paid' }],
      point_refunds: [{ point_order_id: 'po_test', principal_points: 500, status: 'pending' }],
    };
    const context = {
      data, esc: value => String(value ?? ''), expiringPointsSummary: () => null,
      T: { orderPaid: id => id, orderRemain: n => String(n), retryRefund: 'Retry refund', refundPending: 'Pending refund' },
    };
    const output = vm.runInNewContext(render + '\nrenderPoints(data)', context);
    assert.match(output, /data-refund="po_test" data-max="500" data-pending="1"/);
    assert.match(output, /Retry refund/);
    let refreshes = 0;
    let sent;
    const btn = { dataset: { pending: '1' }, disabled: false };
    Object.assign(context, {
      btn, FELLOW: '', token: 'member-token',
      prompt: () => assert.fail('retry must keep the original pending refund amount'),
      fetch: async (_url, options) => {
        sent = JSON.parse(options.body);
        return { ok: false, json: async () => ({ refund_id: 'prf_test', error: 'pending' }) };
      },
      main: async () => { refreshes++; }, showToast() {},
    });
    const refund = html.slice(html.indexOf('  async function refundPoints('), html.indexOf('  async function fulfillPointsIfNeeded('));
    await vm.runInNewContext(refund + "\nrefundPoints('po_test', 500, btn)", context);
    assert.deepEqual(sent, { point_order_id: 'po_test', principal_points: 500 });
    assert.equal(refreshes, 1);
    assert.equal(btn.disabled, false);
  });

  test(`${page}: admin member view only renders their own membership`, async () => {
    const html = fs.readFileSync(new URL('../public/' + page, import.meta.url), 'utf8');
    const main = html.slice(html.indexOf('  async function main()'), html.indexOf("  document.addEventListener('visibilitychange'"));
    let rendered;
    const data = { role: 'admin', me: { id: 'audit_admin' }, commitments: [
      { id: 'other-membership', user_id: 'audit_other' },
      { id: 'own-membership', user_id: 'audit_admin' },
    ] };
    await vm.runInNewContext(main + '\nmain()', {
      token: 'member-token', FELLOW: '', fulfillPointsIfNeeded: async () => {}, fulfillPlanIfNeeded: async () => {},
      fetch: async () => ({ ok: true, json: async () => data }),
      renderMember: value => { rendered = value; },
    });
    assert.deepEqual(rendered.commitments, [{ id: 'own-membership', user_id: 'audit_admin' }]);
  });
}

test('EXPIRING_WITHIN_DAYS is 30', () => {
  assert.equal(EXPIRING_WITHIN_DAYS, 30);
});

test('pickNextEvent prefers soonest registered future event', () => {
  const events = [
    { id: '1', title: 'A', starts_at: '2026-07-20T00:00:00.000Z', registered: false },
    { id: '2', title: 'B', starts_at: '2026-07-18T00:00:00.000Z', registered: true },
    { id: '3', title: 'C', starts_at: '2026-07-15T00:00:00.000Z', registered: false },
  ];
  assert.equal(pickNextEvent(events, now).id, '2');
});

test('pickNextEvent falls back to soonest upcoming if none registered', () => {
  const events = [
    { id: '1', title: 'A', starts_at: '2026-07-20T00:00:00.000Z', registered: false },
    { id: '3', title: 'C', starts_at: '2026-07-15T00:00:00.000Z', registered: false },
  ];
  assert.equal(pickNextEvent(events, now).id, '3');
});

test('pickNextEvent returns null when empty or all past', () => {
  assert.equal(pickNextEvent([], now), null);
  assert.equal(pickNextEvent([
    { id: '1', starts_at: '2026-07-01T00:00:00.000Z', registered: true },
  ], now), null);
});

test('expiringPointsSummary sums remaining within 30d and picks earliest date', () => {
  const lots = [
    { remaining: 10, expires_at: '2026-07-20T00:00:00.000Z', available: true },
    { remaining: 20, expires_at: '2026-07-25T00:00:00.000Z', available: true },
    { remaining: 50, expires_at: null, available: true },
    { remaining: 5, expires_at: '2026-09-01T00:00:00.000Z', available: true },
    { remaining: 99, expires_at: '2026-07-13T00:00:00.000Z', available: false },
  ];
  const s = expiringPointsSummary(lots, now);
  assert.equal(s.points, 30);
  assert.equal(new Date(s.soonest).toISOString(), '2026-07-20T00:00:00.000Z');
});

test('expiringPointsSummary returns null when none', () => {
  assert.equal(expiringPointsSummary([
    { remaining: 10, expires_at: null, available: true },
  ], now), null);
});

test('membershipStatusTitle covers main states', () => {
  const T = {
    statusActive: (plan) => `${plan}進行中`,
    statusPending: '待首次進場啟用',
    statusExpired: '會籍已到期',
    statusNone: '尚未有會籍',
  };
  assert.match(membershipStatusTitle({
    active: true, planLabel: '月票', pending: false, hadEntitlement: true,
  }, T), /月票進行中/);
  assert.equal(membershipStatusTitle({
    active: false, planLabel: '', pending: true, hadEntitlement: true,
  }, T), '待首次進場啟用');
  assert.equal(membershipStatusTitle({
    active: false, planLabel: '', pending: false, hadEntitlement: true,
  }, T), '會籍已到期');
  assert.equal(membershipStatusTitle({
    active: false, planLabel: '', pending: false, hadEntitlement: false,
  }, T), '尚未有會籍');
});
