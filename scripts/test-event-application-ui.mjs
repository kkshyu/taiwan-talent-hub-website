import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { randomUUID } from 'node:crypto';

const html = fs.readFileSync(new URL('../public/event-application.html', import.meta.url), 'utf8');
const script = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].at(-1)[1];
const example = {
  community_name: '測試社群', contact_name: '測試聯絡人', contact_email: 'test@example.com',
  contact_phone: '', title: '測試活動', description: '社群交流', starts_at: '2099-09-20T18:00',
  ends_at: '2099-09-20T20:00', attendees: '20', requirements: '', consent: true,
};
const storage = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) };
};
const tokenFor = (sub, nonce = 'original') => Buffer.from(JSON.stringify({ sub, nonce })).toString('base64url') + '.test-signature';
function page({ hash = '#token=' + tokenFor('user-a'), path = '/event-application', draftStorage = storage() } = {}) {
  const elements = new Map(), calls = [], localStorage = storage(), replaced = [];
  const node = id => {
    if (!elements.has(id)) elements.set(id, { value: '', textContent: '', hidden: false, disabled: false, handlers: {}, addEventListener(event, fn) { this.handlers[event] = fn; }, setCustomValidity(value) { this.validation = value; } });
    return elements.get(id);
  };
  const form = node('ea-form');
  form.elements = Object.fromEntries(Object.entries(example).map(([name, value]) => [name, { ...node('ea-' + name), value: name === 'consent' ? '' : value, checked: name === 'consent', required: !['requirements', 'contact_phone'].includes(name) }]));
  form.reportValidity = () => Object.values(form.elements).every(field => !field.validation);
  form.reset = () => { for (const field of Object.values(form.elements)) { field.value = ''; field.checked = false; } };
  let response = { status: 201, data: { ok: true, application: { id: 1 } } };
  const context = vm.createContext({
    document: { getElementById: node, querySelector: () => ({}) },
    location: { pathname: path, origin: 'https://example.test', search: '?keep=1', hash },
    history: { replaceState: (_state, _title, url) => replaced.push(url) },
    localStorage, sessionStorage: draftStorage, crypto: { randomUUID }, URLSearchParams, AbortController, Intl,
    setTimeout, clearTimeout, atob, confirm: () => true,
    FormData: class { constructor() { this.entries = Object.entries(form.elements).map(([name, field]) => [name, field.value]); } [Symbol.iterator]() { return this.entries[Symbol.iterator](); } },
    fetch: async (url, options) => {
      if (!options.body) return { ok: true, json: async () => ({ applications: [] }) };
      calls.push(JSON.parse(options.body));
      if (response instanceof Error) throw response;
      return { ok: response.status < 400, status: response.status, json: async () => response.data };
    },
  });
  vm.runInContext(script, context);
  return {
    node, form, context, calls, localStorage, draftStorage, replaced,
    fill() { for (const [name, value] of Object.entries(example)) { form.elements[name].value = name === 'consent' ? '' : value; form.elements[name].checked = name === 'consent'; } form.handlers.input(); },
    reply(value) { response = value; },
    submit: () => form.handlers.submit({ preventDefault() {} }),
  };
}

test('application UI keeps the exact request across uncertain delivery and clears only on confirmed success', async () => {
  const p = page();
  assert.deepEqual(p.replaced, ['/event-application?keep=1']);
  assert.equal(p.localStorage.getItem('tth_token'), tokenFor('user-a'));
  p.fill();
  p.reply(new Error('network failure'));
  await p.submit();
  assert.equal(p.node('ea-fields').disabled, true);
  assert.ok(JSON.parse(p.draftStorage.getItem('tth_event_application_draft')).pending);
  p.reply({ status: 200, data: {} });
  await p.submit();
  assert.equal(p.node('ea-fields').disabled, true);
  assert.equal(p.calls.length, 2);
  assert.deepEqual(p.calls[0], p.calls[1]);
  p.reply({ status: 200, data: { ok: true, application: { id: 1, status: 'approved' } } });
  await p.submit();
  assert.deepEqual(p.calls[1], p.calls[2]);
  assert.equal(p.draftStorage.getItem('tth_event_application_draft'), null);
  assert.equal(p.form.elements.title.value, '');
  assert.match(p.node('ea-message').textContent, /不代表已保留場地/);
  assert.match(p.node('ea-message').textContent, /申請編號: 1/);
  assert.doesNotMatch(p.node('ea-message').textContent, /等待審核/);
});

test('validation failure permits correcting the same draft; expired login preserves it for sign-in', async () => {
  const p = page();
  p.fill();
  p.reply({ status: 400, data: { error: '請修正內容' } });
  await p.submit();
  assert.equal(p.node('ea-fields').disabled, false);
  const key = p.calls[0].request_id;
  p.form.elements.title.value = '已修正活動';
  p.form.handlers.input();
  p.reply({ status: 401, data: { error: 'expired' } });
  await p.submit();
  assert.equal(p.calls[1].request_id, key);
  assert.equal(p.localStorage.getItem('tth_token'), null);
  assert.equal(p.node('ea-login').hidden, false);
  assert.equal(p.node('ea-submit').disabled, true);
  const next = page({ draftStorage: p.draftStorage, hash: '#token=' + tokenFor('user-a', 'refreshed') });
  assert.equal(next.form.elements.title.value, '已修正活動');
  await next.submit();
  assert.deepEqual(next.calls[0], p.calls[1]);
});

test('all three locales render the three application steps and display timestamps in Taiwan time', () => {
  for (const [prefix, heading, step] of [['', '申請社群活動', '聯絡資料'], ['/en', 'Apply for a community event', 'Contact details'], ['/ja', 'コミュニティ活動の会場利用申請', '連絡先']]) {
    const p = page({ path: prefix + '/event-application', hash: '' });
    assert.match(p.node('content').innerHTML, new RegExp(heading));
    assert.match(p.node('content').innerHTML, new RegExp(step));
    assert.equal(p.node('ea-submit').disabled, true);
    assert.match(vm.runInContext("when('2099-09-20T10:00:00.000Z')", p.context), /18:00/);
    assert.equal(vm.runInContext("esc('<script>')", p.context), '&lt;script&gt;');
  }
});


test('an uncertain submission cannot be retried under a different account', async () => {
  const original = page();
  original.fill();
  original.reply(new Error('response lost after insertion'));
  await original.submit();
  const saved = original.draftStorage.getItem('tth_event_application_draft');
  assert.equal(JSON.parse(saved).sub, 'user-a');
  original.reply({ status: 401, data: { error: 'expired' } });
  await original.submit();
  const other = page({ draftStorage: original.draftStorage, hash: '#token=' + tokenFor('user-b') });
  assert.equal(other.node('ea-submit').disabled, true);
  assert.equal(other.node('ea-login').hidden, false);
  assert.match(other.node('ea-login-note').textContent, /原帳號登入確認/);
  await other.submit();
  assert.equal(other.calls.length, 0);
  assert.equal(other.draftStorage.getItem('tth_event_application_draft'), saved);
  const same = page({ draftStorage: original.draftStorage, hash: '#token=' + tokenFor('user-a', 'refreshed') });
  await same.submit();
  assert.deepEqual(same.calls[0], original.calls[0]);
  other.node('ea-clear').handlers.click();
  other.fill();
  await other.submit();
  assert.equal(other.calls.length, 1);
  assert.notEqual(other.calls[0].request_id, original.calls[0].request_id);
});
