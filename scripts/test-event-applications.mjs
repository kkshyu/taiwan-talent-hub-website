import assert from 'node:assert/strict';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { normalizeEventApplication } = require('../lib/event-applications.js');
const { Pool } = require('pg');
const valid = {
  community_name: '測試社群', contact_name: '測試聯絡人', contact_email: 'organizer@example.test',
  contact_phone: '', title: '測試工作坊', description: '只供本機測試的活動內容',
  starts_at: '2099-06-20T19:00', ends_at: '2099-06-20T21:00', attendees: '20',
  requirements: '投影設備', consent: true,
};

test('application normalizes text, attendees and Taiwan local time', () => {
  const { value, error } = normalizeEventApplication({ ...valid, community_name: ' 測試社群 ' });
  assert.equal(error, undefined);
  assert.equal(value.community_name, '測試社群');
  assert.equal(value.attendees, 20);
  assert.equal(value.starts_at, '2099-06-20T11:00:00.000Z');
  assert.equal(value.ends_at, '2099-06-20T13:00:00.000Z');
});

test('application rejects missing, oversized and malformed contact/content fields', () => {
  for (const body of [null, [], 'text', {},
    ...['community_name', 'contact_name', 'contact_email', 'title', 'description'].map(key => ({ ...valid, [key]: ' ' })),
    ...Object.entries({ community_name: 121, contact_name: 81, contact_email: 255, contact_phone: 41,
      title: 161, description: 5001, requirements: 2001 }).map(([key, size]) => ({ ...valid, [key]: 'x'.repeat(size) })),
    { ...valid, contact_email: 'bad@address' }, { ...valid, requirements: {} },
    { ...valid, description: 'paste\0content' },
  ]) assert.ok(normalizeEventApplication(body).error, JSON.stringify(body).slice(0, 150));
});

test('application rejects impossible dates, reversed ranges and implicit timezones', () => {
  for (const starts_at of ['2099-02-29T10:00', '2099-04-31T10:00', '2099-06-20T24:00',
    '2099-13-01T10:00', '2099-06-20', '2099-06-20T10:00Z', '2099-06-20T10:00+08:00']) {
    assert.ok(normalizeEventApplication({ ...valid, starts_at }).error, starts_at);
  }
  for (const ends_at of [valid.starts_at, '2099-06-20T18:00', '2099-06-31T21:00']) {
    assert.ok(normalizeEventApplication({ ...valid, ends_at }).error, ends_at);
  }
  assert.ok(normalizeEventApplication({ ...valid, starts_at: '2096-02-29T10:00' }).value);
});

test('application kind defaults to community on 3F; business hire must pick 2F or 3F', () => {
  assert.deepEqual([normalizeEventApplication(valid).value.kind, normalizeEventApplication(valid).value.venue], ['community', '3F']);
  assert.equal(normalizeEventApplication({ ...valid, kind: 'community', venue: '2F' }).value.venue, '3F');
  assert.ok(normalizeEventApplication({ ...valid, kind: 'business' }).error);
  assert.ok(normalizeEventApplication({ ...valid, kind: 'business', venue: '4F' }).error);
  assert.ok(normalizeEventApplication({ ...valid, kind: 'vip' }).error);
  for (const venue of ['2F', '3F']) assert.equal(normalizeEventApplication({ ...valid, kind: 'business', venue }).value.venue, venue);
});

test('application requires explicit consent and bounded integer attendance', () => {
  for (const attendees of [0, -1, 1.5, 10001, '', '1e2', true, [], null])
    assert.ok(normalizeEventApplication({ ...valid, attendees }).error, String(attendees));
  for (const consent of [false, undefined, 'true', 1])
    assert.ok(normalizeEventApplication({ ...valid, consent }).error, String(consent));
  for (const attendees of [1, 10000]) assert.ok(normalizeEventApplication({ ...valid, attendees }).value);
});

const databaseUrl = process.env.EVENT_APPLICATION_TEST_DATABASE_URL;

test('application API persists private submissions and serializes retry/review races in PostgreSQL', {
  skip: !databaseUrl && 'Set EVENT_APPLICATION_TEST_DATABASE_URL to an isolated local PostgreSQL database.',
  timeout: 45000,
}, async t => {
  const db = new URL(databaseUrl);
  assert.ok(['postgres:', 'postgresql:'].includes(db.protocol), 'PostgreSQL URL required');
  assert.ok(['127.0.0.1', 'localhost', '[::1]', '::1'].includes(db.hostname), 'Only loopback PostgreSQL is allowed');
  assert.equal(db.search, '', 'Supply a plain URL without query overrides; the test sets its own search_path');
  // Explicit credentials prevent pg from falling back to inherited PGUSER/PGPASSWORD or .pgpass.
  db.username ||= 'postgres';
  db.password ||= 'local-test-password';
  db.pathname = db.pathname && db.pathname !== '/' ? db.pathname : '/postgres';
  db.port ||= '5432';
  const schema = 'test_event_applications_' + randomBytes(8).toString('hex');
  db.searchParams.set('options', '-c search_path=pg_catalog');
  const control = new Pool({ connectionString: db.href, ssl: false, max: 1,
    connectionTimeoutMillis: 5000, statement_timeout: 10000 });
  let schemaCreated = false, pool, child, logs = '', childError;
  const secret = randomBytes(32).toString('hex'), adminKey = randomBytes(32).toString('hex');
  const users = ['application_member_a', 'application_member_b'];
  const token = sub => {
    const iat = Date.now();
    const body = Buffer.from(JSON.stringify({ sub, role: 'invited', purpose: 'session', iat, exp: iat + 600000 })).toString('base64url');
    return body + '.' + createHmac('sha256', secret).update(body).digest('base64url');
  };
  const stopServer = async () => {
    if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
    await new Promise(resolve => {
      const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
      child.kill('SIGTERM');
    });
  };
  try {
    await control.query(`CREATE SCHEMA ${schema}`);
    schemaCreated = true;
    db.searchParams.set('options', `-c search_path=${schema}`);
    pool = new Pool({ connectionString: db.href, ssl: false, max: 2,
      connectionTimeoutMillis: 5000, statement_timeout: 10000 });
    assert.equal((await pool.query('SELECT current_schema() AS name')).rows[0].name, schema);
    const listener = createServer();
    await new Promise((resolve, reject) => { listener.once('error', reject); listener.listen(0, '127.0.0.1', resolve); });
    const port = listener.address().port;
    await new Promise(resolve => listener.close(resolve));
    const origin = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, ['server.js'], {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      // No inherited .env, NODE_OPTIONS, database, Google, payment, AI, IG or storage credentials.
      env: { NODE_ENV: 'test', PORT: String(port), DATABASE_URL: db.href, APP_SECRET: secret,
        ADMIN_API_KEY: adminKey, SUPER_ADMIN_EMAIL: 'admin@example.test', IG_AUTOPUBLISH: '0',
        PUBLIC_ORIGIN: origin, WEB_ORIGINS: origin, TRUST_PROXY_HOPS: '0', TZ: 'Asia/Taipei' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.on('error', error => { childError = error; });
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { logs = (logs + chunk).slice(-12000); });
    let ready = false;
    for (let attempt = 0; attempt < 150; attempt++) {
      assert.equal(childError, undefined, String(childError));
      assert.equal(child.exitCode, null, logs);
      try {
        const response = await fetch(origin + '/api/events', { signal: AbortSignal.timeout(1000) });
        await response.text();
        if (response.ok) { ready = true; break; }
      } catch { /* Server has not bound its port yet. */ }
      await delay(100);
    }
    assert.ok(ready, 'Server did not become ready:\n' + logs);
    await pool.query(`INSERT INTO users (id,name,email,status) VALUES ($1,'Member A','a@example.test','invited'),($2,'Member B','b@example.test','invited')`, users);
    const [memberA, memberB] = users.map(token);
    const api = async (path, auth, body) => {
      const response = await fetch(origin + path, {
        method: body === undefined ? 'GET' : 'POST', signal: AbortSignal.timeout(5000),
        headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer ' + auth } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: await response.json() };
    };
    const submit = (auth, body) => api('/api/event-applications', auth, body);
    const input = { ...valid, request_id: randomUUID() };
    let applicationId, reviewResult;

    await t.test('authentication and invalid input cannot write applications', async () => {
      assert.equal((await submit(null, input)).status, 401);
      assert.equal((await api('/api/me/event-applications')).status, 401);
      assert.equal((await api('/api/admin/event-applications', memberA)).status, 403);
      assert.equal((await submit(adminKey, input)).status, 403);
      assert.equal((await api('/api/me/event-applications', adminKey)).status, 403);
      for (const patch of [{ request_id: 'bad' }, { starts_at: '2099-02-30T19:00' },
        { starts_at: '2000-01-01T19:00', ends_at: '2000-01-01T21:00' }, { consent: false }, { description: 'paste\0content' }])
        assert.equal((await submit(memberA, { ...input, ...patch })).status, 400);
      assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM event_applications')).rows[0].n, 0);
    });

    await t.test('concurrent identical retries create one row; changed payload conflicts', async () => {
      const results = await Promise.all([submit(memberA, input), submit(memberA, input)]);
      assert.deepEqual(results.map(result => result.status).sort(), [200, 201]);
      applicationId = results[0].body.application.id;
      assert.equal(results[1].body.application.id, applicationId);
      const retried = await submit(memberA, input);
      assert.equal(retried.status, 200);
      assert.equal(retried.body.application.id, applicationId);
      assert.equal(retried.body.application.status, 'pending');
      assert.equal(retried.body.application.starts_at, '2099-06-20T11:00:00.000Z');
      assert.equal((await submit(memberA, { ...input, title: 'Changed payload' })).status, 409);
      assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM event_applications')).rows[0].n, 1);
      // The same request UUID belongs independently to each member.
      assert.equal((await submit(memberB, { ...input, title: 'Member B workshop' })).status, 201);
    });

    await t.test('only the owner sees their submission; administrators see both', async () => {
      for (const [auth, user] of [[memberA, users[0]], [memberB, users[1]]]) {
        const list = await api('/api/me/event-applications?user_id=' + users[0], auth);
        assert.equal(list.status, 200);
        assert.equal(list.body.applications.length, 1);
        assert.equal(list.body.applications[0].user_id, user);
        assert.equal(list.body.applications[0].request_hash, undefined);
      }
      const admin = await api('/api/admin/event-applications', adminKey);
      assert.equal(admin.status, 200);
      assert.equal(admin.body.applications.length, 2);
    });

    await t.test('reviews require admin access and one concurrent decision wins', async () => {
      const path = `/api/admin/event-applications/${applicationId}/review`;
      const review = { status: 'approved', expected_status: 'pending', review_note: '測試審核回覆，請聯絡確認。' };
      assert.equal((await api(path, memberB, review)).status, 403);
      assert.equal((await api(path, adminKey, { ...review, review_note: '' })).status, 400);
      assert.equal((await api('/api/admin/event-applications/missing/review', adminKey, review)).status, 404);
      const results = await Promise.all([api(path, adminKey, review), api(path, adminKey, { ...review, status: 'rejected' })]);
      assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
      reviewResult = results.find(result => result.status === 200).body.application;
      assert.ok(reviewResult.reviewed_at);
      const own = await api('/api/me/event-applications', memberA);
      assert.equal(own.body.applications[0].review_note, review.review_note);
      assert.equal(own.body.applications[0].status, reviewResult.status);
      const other = await api('/api/me/event-applications', memberB);
      assert.equal(other.body.applications[0].review_note, '');
      assert.ok(!JSON.stringify(other.body).includes(review.review_note));
    });

    await t.test('applications and review replies never become public events or member state', async () => {
      for (const [path, auth] of [['/api/events', undefined], ['/api/state', memberA], ['/api/state', memberB], ['/api/state', adminKey]]) {
        const result = await api(path, auth);
        assert.equal(result.status, 200);
        assert.deepEqual(result.body.events, []);
        assert.ok(!JSON.stringify(result.body).includes(applicationId));
        assert.ok(!JSON.stringify(result.body).includes(reviewResult.review_note));
      }
      assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM events')).rows[0].n, 0);
    });

    await t.test('stored submissions and consent survive server shutdown', async () => {
      await stopServer();
      const rows = (await pool.query('SELECT * FROM event_applications ORDER BY user_id')).rows;
      assert.equal(rows.length, 2);
      assert.equal(rows[0].id, applicationId);
      assert.equal(rows[0].review_note, reviewResult.review_note);
      assert.equal(rows[0].status, reviewResult.status);
      assert.ok(rows.every(row => row.consent_at instanceof Date));
    });
  } finally {
    await stopServer();
    try { if (pool) await pool.end(); }
    finally {
      try { if (schemaCreated) await control.query(`DROP SCHEMA ${schema} CASCADE`); }
      finally { await control.end(); }
    }
  }
});
