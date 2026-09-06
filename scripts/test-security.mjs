import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { once } from 'node:events';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname || path.dirname(new URL(import.meta.url).pathname), '..');
const { signToken, verifyToken, safeEqual, matchesPointCheckout, PUBLIC_CONTENT_KEYS, rateLimit } = require('../lib/security');
const { isAdminApiKey } = require('../lib/admin-key');
const { signAccessToken, verifyAccessToken } = require('../lib/access-token');
const secret = 'local-test-secret-not-used-in-production';
const adminKey = 'test-admin-key-isolated-http-test';
const user = { id: 'u_test', email: 'member@example.test', is_admin: false };
const order = { id: 'po_test', user_id: user.id, pack_id: 'p_test', stripe_session_id: 'cs_test', pay_twd: 100,
  principal: 100, bonus: 0, status: 'pending' };
const paid = { id: order.stripe_session_id, payment_status: 'paid', currency: 'twd', amount_total: 10000,
  payment_intent: 'pi_test', metadata: { kind: 'point_pack', point_order_id: order.id, user_id: user.id, pack_id: order.pack_id } };

// Execute real Express routes with isolated DB/payment doubles; this never reads .env or opens an external service.
async function server(t, { query, stripe = {}, env = {} } = {}) {
  const log = [], errors = [];
  const run = async (sql, args = []) => {
    log.push({ sql, args });
    const result = await query?.(sql, args);
    if (result) return result;
    if (/SELECT id,email,is_admin FROM users/.test(sql)) return { rows: [{ ...user }], rowCount: 1 };
    if (/SUM\(amount\)/.test(sql)) return { rows: [{ s: 0, p: 0 }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  };
  const localRequire = name => {
    if (name === 'pg') return { Pool: class { query = run; async connect() { return { query: run, release() {} }; } } };
    if (name === 'stripe') return class { constructor() { return stripe; } };
    return createRequire(path.join(root, 'server.js'))(name);
  };
  const module = { exports: {} };
  const context = vm.createContext({ require: localRequire, module, __dirname: root,
    process: { env: { NODE_ENV: 'test', APP_SECRET: secret, ADMIN_API_KEY: adminKey,
      DATABASE_URL: 'unused-test-double', STRIPE_SECRET_KEY: 'stub', STRIPE_WEBHOOK_SECRET: 'stub',
      GOOGLE_CLIENT_ID: 'stub', PUBLIC_ORIGIN: 'http://127.0.0.1', ACCESS_QR_SECRET: secret, ACCESS_DOOR_SECRET: secret, ...env } },
    Buffer, URL, URLSearchParams, AbortSignal, Date, setTimeout,
    fetch: () => { throw new Error('External network forbidden in test'); },
    console: { log() {}, warn() {}, error(...args) { errors.push(args.join(' ')); } },
  });
  new vm.Script(readFileSync(path.join(root, 'server.js'), 'utf8') + '\ndbReady = true;').runInContext(context);
  const http = module.exports.app.listen(0, '127.0.0.1');
  await once(http, 'listening');
  t.after(() => new Promise(resolve => { http.close(resolve); http.closeAllConnections(); }));
  const base = `http://127.0.0.1:${http.address().port}`;
  const request = (url, body, token) => fetch(base + url, {
    method: body === undefined ? 'GET' : 'POST', redirect: 'manual',
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { request, base, log, errors };
}

test('session is purpose-bound, expiring, strictly segmented and rejects non-ASCII signatures safely', () => {
  const token = signToken({ sub: user.id, role: 'admin' }, secret, { now: 100 });
  assert.equal(verifyToken(token, secret, { now: 101 }).sub, user.id);
  assert.equal(verifyToken(token, secret, { now: 100 + 7 * 86400_000 }), null);
  assert.equal(verifyToken(token, secret, { now: 99 }), null);
  assert.equal(verifyToken(token + '.extra', secret, { now: 101 }), null);
  assert.equal(verifyToken(signToken({ sub: user.id, role: 'admin' }, secret, { purpose: 'oauth' }), secret), null);
  assert.equal(verifyToken(token.split('.')[0] + '.' + 'é'.repeat(43), secret), null);
  assert.equal(safeEqual('é'.repeat(24), 'a'.repeat(24)), false);
  assert.equal(isAdminApiKey('é'.repeat(adminKey.length), adminKey), false);
  const qr = signAccessToken({ sub: 'u', ent: 'e', plan: 'month' }, secret);
  assert.equal(verifyAccessToken(qr.split('.')[0] + '.' + 'é'.repeat(43), secret), null);
});

test('payment fulfillment binds every order field, currency, exact amount and paid session', () => {
  assert.equal(matchesPointCheckout(paid, order), true);
  for (const change of [{ id: 'cs_other' }, { currency: 'usd' }, { amount_total: 9999 },
    { amount_total: '10000' }, { payment_status: 'unpaid' }, { metadata: {} },
    ...['kind', 'point_order_id', 'user_id', 'pack_id'].map(key => ({ metadata: { ...paid.metadata, [key]: 'other' } }))]) {
    assert.equal(matchesPointCheckout({ ...paid, ...change }, order), false);
  }
});

test('rate limit expires and cannot grow without a bound', () => {
  let time = 1000, accepted = 0, status;
  const limit = rateLimit({ max: 2, windowMs: 100, now: () => time });
  const res = { set() {}, status(s) { status = s; return this; }, json() {} };
  const req = { ip: '127.0.0.1' };
  for (let i = 0; i < 3; i++) limit(req, res, () => accepted++);
  assert.equal(accepted, 2); assert.equal(status, 429);
  time += 100; limit(req, res, () => accepted++); assert.equal(accepted, 3);
});

test('HTTP headers and parser errors protect pages/API without leaking stack traces', async t => {
  const { request, base } = await server(t);
  const health = await request('/api/health');
  assert.equal(health.headers.get('x-powered-by'), null);
  assert.equal(health.headers.get('cache-control'), 'no-store');
  assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
  assert.match(health.headers.get('content-security-policy'), /frame-ancestors 'self'/);
  const malformed = await fetch(base + '/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' });
  assert.equal(malformed.status, 400);
  assert.deepEqual(await malformed.json(), { error: '請求格式不正確。' });
  const badToken = await request('/api/state', undefined, 'x.' + 'é'.repeat(43));
  assert.equal(badToken.status, 401);
});

test('OAuth state must match the browser cookie and cannot become an API session', async t => {
  const { request, base } = await server(t);
  const start = await request('/auth/google');
  const state = new URL(start.headers.get('location')).searchParams.get('state');
  assert.match(start.headers.get('set-cookie'), /HttpOnly/);
  assert.match(start.headers.get('set-cookie'), /SameSite=Lax/);
  const callback = await request('/auth/google/callback?state=' + encodeURIComponent(state) + '&code=unused');
  assert.equal(callback.status, 400);
  const sameBrowser = await fetch(base + '/auth/google/callback?state=' + encodeURIComponent(state),
    { headers: { cookie: `oauth_state=${state}` } });
  assert.equal(await sameBrowser.text(), '登入未完成。');
  assert.equal((await request('/api/state', undefined, state)).status, 401);
});

test('public content excludes internal credentials; content writes and stale admin tokens cannot bypass policy', async t => {
  const { request, log } = await server(t, { query(sql, args) {
    if (/SELECT key, value FROM site_content/.test(sql)) {
      assert.match(sql, /WHERE key = ANY/);
      return { rows: [{ key: 'home_notice', value: 'hello' }, { key: 'ig_access_token', value: 'test-secret' }].filter(r => args[0].includes(r.key)) };
    }
  } });
  const data = await (await request('/api/public')).json();
  assert.deepEqual(data.content, { home_notice: 'hello' });
  assert.equal(PUBLIC_CONTENT_KEYS.includes('ig_access_token'), false);
  const revoked = signToken({ sub: user.id, role: 'admin', super: true }, secret);
  assert.equal((await request('/api/admin/content', { key: 'home_notice', value: 'x' }, revoked)).status, 403);
  assert.equal((await request('/api/admin/content', { key: 'ig_access_token', value: 'x' }, adminKey)).status, 400);
  assert.equal((await request('/api/commitments', { amount: 35000, term: 18, name: '測試', phone: '123', email: 'attacker@example.test' }, revoked)).status, 400);
  assert.equal(log.some(x => /^UPDATE users/.test(x.sql)), false);
});

test('session-based admin uploads fail closed when the authorization database is unavailable', async t => {
  const { request } = await server(t, { env: { DATABASE_URL: '' } });
  const token = signToken({ sub: user.id, role: 'admin', super: true }, secret);
  for (const dir of ['space', 'social']) {
    assert.equal((await request('/api/admin/upload/' + dir, {}, token)).status, 503);
  }
});

test('both upload routes reject forged MIME and accept an embedded PNG with safe filename', async t => {
  const { base } = await server(t);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1EAAAAASUVORK5CYII=', 'base64');
  for (const dir of ['space', 'social']) {
    for (const [bytes, status] of [[Buffer.from('<html>not an image</html>'), 400], [png, 200]]) {
      const form = new FormData(); form.set('file', new Blob([bytes], { type: 'image/png' }), '../../test.png');
      const result = await fetch(base + '/api/admin/upload/' + dir, { method: 'POST', headers: { authorization: `Bearer ${adminKey}` }, body: form });
      const data = await result.json();
      assert.equal(result.status, status, JSON.stringify(data));
      if (status === 200) {
        assert.match(data.url, new RegExp(`^/uploads/${dir}/${dir}-[a-z0-9]+-[0-9a-f]+\\.png$`));
        unlinkSync(path.join(root, data.url));
      }
    }
  }
});

test('a still-signed door QR cannot open an expired entitlement', async t => {
  const now = Date.now();
  const entitlement = { id: 'en_test', user_id: user.id, plan: 'month', purchased_at: new Date(now - 86400_000),
    activated_at: new Date(now - 86400_000), starts_at: new Date(now - 86400_000), ends_at: new Date(now - 1) };
  const { request, log } = await server(t, { query: sql => /FROM entitlements WHERE id/.test(sql) ? { rows: [entitlement] } : null });
  const token = signAccessToken({ sub: user.id, ent: entitlement.id, plan: entitlement.plan }, secret);
  assert.equal((await request('/api/access/scan', { token }, secret)).status, 403);
  assert.equal(log.some(x => /INSERT INTO access_scans/.test(x.sql)), false);
});

test('point webhook credits once; a mismatched session cannot credit the order', async t => {
  const currentOrder = { ...order };
  const lots = [];
  const stripe = { webhooks: { constructEvent: body => JSON.parse(body.toString()) } };
  const { request } = await server(t, { stripe, query(sql, args) {
    if (/SELECT \* FROM point_orders/.test(sql)) return { rows: [{ ...currentOrder }] };
    if (/UPDATE point_orders SET status='paid'/.test(sql)) { currentOrder.status = 'paid'; return { rows: [{ ...currentOrder }] }; }
    if (/INSERT INTO point_lots/.test(sql)) {
      const row = { id: args[0], user_id: args[1], type: args[2], original_amount: args[3], remaining: args[3], expires_at: args[4] };
      lots.push(row); return { rows: [row] };
    }
  } });
  const event = session => ({ type: 'checkout.session.completed', data: { object: session } });
  assert.equal((await request('/api/stripe/webhook', event({ ...paid, amount_total: 1 }))).status, 400);
  assert.equal(lots.length, 0);
  assert.equal((await request('/api/stripe/webhook', event(paid))).status, 200);
  assert.equal((await request('/api/stripe/webhook', event(paid))).status, 200);
  assert.equal(lots.length, 1);
  assert.equal(lots[0].remaining, 100);
});

test('founding checkout counts live reservations and locks before scanning Stripe', async t => {
  let scans = 0, created = 0;
  const stripe = { checkout: { sessions: {
    async *list({ status, created: range }) {
      scans++;
      assert.equal(range.gte, Math.floor(Date.parse('2026-07-11T00:00:00+08:00') / 1000));
      if (status === 'open') yield { id: 'cs_reserved', metadata: { plan: 'founding-member' }, payment_status: 'unpaid', expires_at: Date.now() / 1000 + 100 };
    },
    async create() { created++; return { url: 'https://checkout.stripe.com/test' }; },
  } } };
  const { request, log } = await server(t, { stripe, env: { MAX_PARTICIPANTS: '1', SALE_END: '2099-01-01' } });
  assert.equal((await request('/api/checkout', {})).status, 409);
  assert.equal(scans, 1); assert.equal(created, 0);
  assert.match(log[1].sql, /pg_advisory_xact_lock/);
  assert.equal(log.at(-1).sql, 'ROLLBACK');
});

test('Stripe provider outages are retryable 503 responses and never expose credential details', async t => {
  const expired = Object.assign(new Error('Expired API Key provided: sk_live_sensitive'),
    { type: 'StripeAuthenticationError', code: 'api_key_expired' });
  const stripe = { checkout: { sessions: { async *list() { throw expired; } } } };
  const { request, log, errors } = await server(t, { stripe, env: { SALE_END: '2099-01-01' } });
  const response = await request('/api/checkout', {});
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.deepEqual(body, { error: '付款服務暫時無法使用，請稍後再試。', code: 'PAYMENT_UNAVAILABLE' });
  assert.doesNotMatch(JSON.stringify(body), /sk_live|Expired API Key/);
  assert.doesNotMatch(errors.join('\n'), /sk_live|Expired API Key/);
  assert.match(errors.join('\n'), /StripeAuthenticationError api_key_expired/);
  assert.equal(log.at(-1).sql, 'ROLLBACK');
});

test('refund survives external success followed by DB failure; changed amount retries the same persisted intent', async t => {
  const lot = { id: 'lot_1', user_id: user.id, type: 'purchase', original_amount: 100, remaining: 100,
    expires_at: null, source_type: 'point_order', source_id: order.id };
  let intent, externalRefund, creates = 0, failFinalize = true;
  const steps = [];
  const { request } = await server(t, { stripe: {
    checkout: { sessions: { retrieve: async () => paid } },
    refunds: {
      async *list() { if (externalRefund) yield externalRefund; },
      async create(body, options) {
        assert.equal(steps.at(-1), 'COMMIT');
        assert.equal(intent.status, 'pending');
        assert.equal(lot.remaining, 0);
        assert.equal(options.idempotencyKey, `points-refund-${intent.id}`);
        assert.equal(body.amount, 10000);
        creates++;
        externalRefund = { id: 're_test', status: 'succeeded', metadata: body.metadata };
        return externalRefund;
      },
    },
  }, query(sql, args) {
    steps.push(sql);
    if (/SELECT \* FROM point_orders/.test(sql)) return { rows: [{ ...order, status: 'paid' }] };
    if (/SELECT \* FROM point_refunds/.test(sql)) return { rows: intent?.status === 'pending' ? [{ ...intent }] : [] };
    if (/SELECT .* FROM point_lots WHERE user_id=\$1 FOR UPDATE/s.test(sql)) return { rows: [{ ...lot }] };
    if (/SELECT id, user_id, type, original_amount/.test(sql)) return { rows: [{ ...lot }] };
    if (/UPDATE point_lots SET remaining = remaining -/.test(sql)) {
      lot.remaining -= args[1]; return { rows: [{ id: lot.id }], rowCount: 1 };
    }
    if (/INSERT INTO point_refunds/.test(sql)) {
      intent = { id: args[0], point_order_id: args[1], user_id: args[2], principal_points: args[3], refund_twd: args[4], status: 'pending' };
      return { rows: [] };
    }
    if (/UPDATE point_refunds SET status='completed'/.test(sql)) {
      if (failFinalize) { failFinalize = false; throw new Error('simulated DB interruption'); }
      intent.status = 'completed'; return { rows: [], rowCount: 1 };
    }
  } });
  const token = signToken({ sub: user.id, role: 'participant' }, secret);
  const first = await request('/api/me/points/refunds', { point_order_id: order.id, principal_points: 100 }, token);
  assert.equal(first.status, 502);
  assert.equal(intent.status, 'pending'); assert.equal(lot.remaining, 0);
  const retry = await request('/api/me/points/refunds', { point_order_id: order.id, principal_points: 30 }, token);
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).refund.principal_points, 100);
  assert.equal(creates, 1); assert.equal(lot.remaining, 0); assert.equal(intent.status, 'completed');
});

test('founding inventory de-duplicates a checkout paid while pagination runs', async t => {
  const scans = [];
  let creates = 0;
  const { request } = await server(t, { env: { MAX_PARTICIPANTS: '2', SALE_END: '2099-01-01' }, stripe: { checkout: { sessions: {
    async *list({ status }) {
      scans.push(status);
      yield { id: 'cs_same', metadata: { plan: 'founding-member' }, payment_status: status === 'open' ? 'unpaid' : 'paid', expires_at: Date.now() / 1000 + 300 };
    },
    async create(params) { assert.ok(params.expires_at > Date.now() / 1000); creates++; return { url: 'https://checkout.stripe.com/test' }; },
  } } } });
  assert.equal((await request('/api/checkout', {})).status, 200);
  assert.deepEqual(scans, ['open', 'complete']); assert.equal(creates, 1);
});

test('a confirmed failed Stripe refund restores reserved points exactly once and remains visible to the UI', async t => {
  const lot = { id: 'lot_failed', user_id: user.id, type: 'purchase', original_amount: 100, remaining: 100,
    expires_at: null, source_type: 'point_order', source_id: order.id };
  let intent, restores = 0;
  const { request } = await server(t, { stripe: {
    checkout: { sessions: { retrieve: async () => paid } },
    refunds: { async *list() {}, async create(body) { return { id: 're_failed', status: 'failed', metadata: body.metadata }; } },
  }, query(sql, args) {
    if (/SELECT \* FROM point_orders/.test(sql)) return { rows: [{ ...order, status: 'paid' }] };
    if (/SELECT (\*|id) FROM point_refunds/.test(sql)) return { rows: intent?.status === 'pending' ? [{ ...intent }] : [] };
    if (/SELECT \* FROM point_lots/.test(sql)) return { rows: [{ ...lot }] };
    if (/UPDATE point_lots SET remaining = remaining -/.test(sql)) {
      lot.remaining -= args[1]; return { rows: [{ id: lot.id }], rowCount: 1 };
    }
    if (/INSERT INTO point_refunds/.test(sql)) {
      intent = { id: args[0], point_order_id: args[1], principal_points: args[3], refund_twd: args[4], status: 'pending' };
      return { rows: [] };
    }
    if (/SELECT lot_id,delta FROM point_ledger/.test(sql)) return { rows: [{ lot_id: lot.id, delta: -40 }] };
    if (/UPDATE point_lots SET remaining=remaining-/.test(sql)) { lot.remaining -= args[1]; restores++; return { rows: [] }; }
    if (/UPDATE point_refunds SET status='failed'/.test(sql)) { intent.status = 'failed'; return { rows: [] }; }
  } });
  const token = signToken({ sub: user.id, role: 'participant' }, secret);
  const result = await request('/api/me/points/refunds', { point_order_id: order.id, principal_points: 40 }, token);
  assert.equal(result.status, 409);
  assert.equal((await result.json()).refund_id, intent.id);
  assert.equal(intent.status, 'failed'); assert.equal(lot.remaining, 100); assert.equal(restores, 1);
});
