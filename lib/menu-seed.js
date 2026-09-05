'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const MENU_CONTENT_KEY = 'menu';
const VENUES = ['CAFE', 'BAR'];
const CATS = [
  'COFFEE', 'TEA', 'BEVERAGE', 'ALCOHOL',
  'SALAD', 'BREAD', 'JAPANESE', 'DESSERT',
  'COLD_APP', 'HOT_APP', 'FRIED', 'GRILL', 'MAIN', 'SOUP',
  'FOOD', 'SNACK',
];

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/["']/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || 'item';
}

function stableMenuId(row) {
  const cat = CATS.includes(row.cat) ? row.cat : 'FOOD';
  const venue = VENUES.includes(row.venue) ? row.venue : 'CAFE';
  const base = String(row.en || '').trim() || String(row.zh || '').trim() || 'item';
  return `m_${venue.toLowerCase()}_${cat.toLowerCase()}_${slugify(base)}`;
}

function coerceAlcohol(row, cat) {
  if (cat === 'ALCOHOL') return true;
  if (row.note && String(row.note).includes('含酒精')) return true;
  return !!row.alcohol;
}

function normalizeSeedItem(row, index) {
  const cat = CATS.includes(row.cat) ? row.cat : 'FOOD';
  const venue = VENUES.includes(row.venue) ? row.venue : 'CAFE';
  const price = Number(row.price);
  const emo = Number(row.emo);
  return {
    id: row.id || stableMenuId({ ...row, cat, venue }),
    venue,
    cat,
    zh: String(row.zh || '').trim(),
    en: String(row.en || '').trim(),
    price: Number.isFinite(price) ? price : 0,
    emo: Number.isFinite(emo) ? emo : 0,
    note: String(row.note || '').trim(),
    image: String(row.image || '').trim(),
    alcohol: coerceAlcohol(row, cat),
    published: true,
    sort: Number.isFinite(Number(row.sort)) ? Number(row.sort) : (index + 1) * 10,
  };
}

function buildMenuSeedDoc(rows, now = new Date()) {
  const items = (rows || []).map((r, i) => normalizeSeedItem(r, i));
  return {
    version: 1,
    updated_at: now.toISOString(),
    items,
  };
}

function validateMenuSeedDoc(doc) {
  if (!doc || !Array.isArray(doc.items) || doc.items.length === 0) {
    return { ok: false, error: '菜單 seed 為空' };
  }
  for (const it of doc.items) {
    if (!it.zh) return { ok: false, error: '品名（中）必填' };
    if (!VENUES.includes(it.venue)) return { ok: false, error: '店別無效: ' + it.venue };
    if (!CATS.includes(it.cat)) return { ok: false, error: '分類無效: ' + it.cat };
    if (!(it.price >= 0) || !(it.emo >= 0)) return { ok: false, error: '價格無效: ' + it.zh };
  }
  return { ok: true };
}

function shouldWriteMenuSeed(existingContent, force) {
  const raw = existingContent && existingContent[MENU_CONTENT_KEY];
  const missing = raw == null || !String(raw).trim();
  if (force) return true;
  return missing;
}

function loadMenuSeedRows(filePath) {
  const p = filePath || path.join(__dirname, '..', 'public', 'menu-data.js');
  const code = fs.readFileSync(p, 'utf8');
  const sandbox = { window: {}, console };
  vm.runInNewContext(code, sandbox, { filename: p });
  const rows = sandbox.window.__MENU_SEED || sandbox.window.MENU_DATA;
  if (!Array.isArray(rows)) throw new Error('menu-data.js 未匯出 __MENU_SEED');
  return rows;
}

function stringifyMenuDoc(doc) {
  return JSON.stringify(doc);
}

module.exports = {
  MENU_CONTENT_KEY,
  CATS,
  VENUES,
  slugify,
  stableMenuId,
  buildMenuSeedDoc,
  validateMenuSeedDoc,
  shouldWriteMenuSeed,
  loadMenuSeedRows,
  stringifyMenuDoc,
};
