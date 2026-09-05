// scripts/test-menu-lib.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const code = fs.readFileSync(new URL('../public/menu-lib.js', import.meta.url), 'utf8');
const window = {};
vm.runInNewContext(code, { window, console });
const M = window.MenuLib;

test('CATS includes SNACK', () => {
  assert.ok(M.CATS.includes('SNACK'));
  assert.ok(M.CATS.includes('COFFEE'));
});

test('venue defaults to CAFE; sortItems groups CAFE before BAR', () => {
  const a = M.normalizeItem({ cat: 'COFFEE', zh: 'a', price: 1, emo: 1 });
  assert.equal(a.venue, 'CAFE');
  const b = M.normalizeItem({ venue: 'BAR', cat: 'COFFEE', zh: 'b', price: 1, emo: 1 });
  const sorted = M.sortItems([b, a]);
  assert.deepEqual(sorted.map(x => x.zh), ['a', 'b']);
  assert.equal(M.validateDoc({ version: 1, items: [{ ...a, venue: 'XX' }] }).ok, false);
});

test('renderMenuHtml groups by venue then cat', () => {
  const items = M.sortItems([
    M.normalizeItem({ venue: 'BAR', cat: 'ALCOHOL', zh: '琴通寧', en: 'GIN TONIC', price: 250, published: true }),
    M.normalizeItem({ venue: 'CAFE', cat: 'TEA', zh: '果茶', price: 220, published: true }),
    M.normalizeItem({ venue: 'CAFE', cat: 'COFFEE', zh: '拿鐵', price: 180, published: true }),
  ]);
  const html = M.renderMenuHtml(items, 'zh', '空');
  assert.ok(html.indexOf('id="menu-cafe"') < html.indexOf('id="menu-bar"'));
  assert.ok(html.indexOf('拿鐵') < html.indexOf('果茶'));
  assert.ok(html.includes('menu-notice')); // alcohol present
  assert.ok(html.includes('<s>') === false); // no member price → no strikethrough
  assert.equal(M.renderMenuHtml([], 'en', 'Menu coming soon.'), '<p class="menu-empty">Menu coming soon.</p>');
});

test('normalizeItem forces alcohol for ALCOHOL cat', () => {
  const it = M.normalizeItem({ cat: 'ALCOHOL', zh: '啤酒', price: 200, emo: 150, alcohol: false });
  assert.equal(it.alcohol, true);
  assert.equal(it.published, false); // default
  assert.ok(it.id);
});

test('normalizeItem note 含酒精 → alcohol', () => {
  const it = M.normalizeItem({ cat: 'COFFEE', zh: '愛爾蘭', note: '含酒精', price: 1, emo: 1 });
  assert.equal(it.alcohol, true);
});

test('normalizeItem note 僅「酒精」字樣不強制 alcohol', () => {
  const it = M.normalizeItem({ cat: 'COFFEE', zh: '特調', note: '無酒精風味', price: 1, emo: 1 });
  assert.equal(it.alcohol, false);
});

test('parseMenuDoc empty → empty items', () => {
  const doc = M.parseMenuDoc('');
  assert.equal(doc.version, 1);
  assert.ok(Array.isArray(doc.items));
  assert.equal(doc.items.length, 0);
});

test('parseMenuDoc invalid JSON throws or returns empty', () => {
  const doc = M.parseMenuDoc('{not json');
  assert.ok(Array.isArray(doc.items));
  assert.equal(doc.items.length, 0);
});

test('validateDoc rejects empty zh', () => {
  const r = M.validateDoc({
    version: 1, items: [{ id: 'x', cat: 'FOOD', zh: '', en: '', price: 1, emo: 1, alcohol: false, published: false, sort: 0 }],
  });
  assert.equal(r.ok, false);
});

test('validateDoc accepts valid', () => {
  const item = M.normalizeItem({ cat: 'FOOD', zh: '薯條', en: 'FRIES', price: 180, emo: 150 });
  const r = M.validateDoc({ version: 1, items: [item] });
  assert.equal(r.ok, true);
});

test('upsertItem insert and update', () => {
  let doc = { version: 1, items: [] };
  doc = M.upsertItem(doc, { cat: 'FOOD', zh: '水餃', price: 200, emo: 180 });
  assert.equal(doc.items.length, 1);
  const id = doc.items[0].id;
  doc = M.upsertItem(doc, { id, cat: 'FOOD', zh: '實力水餃', price: 200, emo: 180 });
  assert.equal(doc.items.length, 1);
  assert.equal(doc.items[0].zh, '實力水餃');
});

test('removeItem', () => {
  let doc = { version: 1, items: [M.normalizeItem({ cat: 'FOOD', zh: 'A', price: 1, emo: 1 })] };
  const id = doc.items[0].id;
  doc = M.removeItem(doc, id);
  assert.equal(doc.items.length, 0);
});

test('publishedOnly', () => {
  const a = M.normalizeItem({ cat: 'FOOD', zh: 'A', price: 1, emo: 1, published: true });
  const b = M.normalizeItem({ cat: 'FOOD', zh: 'B', price: 1, emo: 1, published: false });
  assert.equal(M.publishedOnly({ items: [a, b] }).length, 1);
});

test('fromSeedRows maps legacy rows', () => {
  const rows = [{ cat: 'COFFEE', zh: '美式', en: 'AMERICANO', price: 170, emo: 150 }];
  const doc = M.fromSeedRows(rows);
  assert.equal(doc.items[0].published, false);
  assert.equal(doc.items[0].zh, '美式');
});
