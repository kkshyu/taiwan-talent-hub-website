'use strict';
(function (global) {
  const VENUES = ['CAFE', 'BAR'];
  // 順序＝前台分組順序；FOOD／SNACK 保留給舊資料相容
  const CATS = [
    'COFFEE', 'TEA', 'BEVERAGE', 'ALCOHOL',
    'SALAD', 'BREAD', 'JAPANESE', 'DESSERT',
    'COLD_APP', 'HOT_APP', 'FRIED', 'GRILL', 'MAIN', 'SOUP',
    'FOOD', 'SNACK',
  ];
  const VENUE_LABEL = {
    CAFE: { zh: '在咖啡', en: 'at cafe', ja: '在咖啡' },
    BAR: { zh: '三點水', en: '3AM', ja: '三點水' },
  };
  const CAT_LABEL = {
    COFFEE: { zh: '咖啡', en: 'Coffee', ja: 'コーヒー' },
    TEA: { zh: '茶', en: 'Tea', ja: 'お茶' },
    BEVERAGE: { zh: '飲品', en: 'Beverage', ja: 'ドリンク' },
    ALCOHOL: { zh: '酒精飲品', en: 'Alcohol', ja: 'アルコール' },
    SALAD: { zh: '沙拉／優格', en: 'Salad & Yogurt', ja: 'サラダ・ヨーグルト' },
    BREAD: { zh: '麵包主食', en: 'Bread', ja: 'パン' },
    JAPANESE: { zh: '日式主食', en: 'Japanese', ja: '和食' },
    DESSERT: { zh: '甜點', en: 'Dessert', ja: 'デザート' },
    COLD_APP: { zh: '冷前菜', en: 'Cold Starters', ja: '冷前菜' },
    HOT_APP: { zh: '熱前菜', en: 'Hot Starters', ja: '温前菜' },
    FRIED: { zh: '炸物', en: 'Fried', ja: '揚げ物' },
    GRILL: { zh: '烤物', en: 'Grilled', ja: '焼き物' },
    MAIN: { zh: '主食', en: 'Mains', ja: '主食' },
    SOUP: { zh: '湯品', en: 'Soup', ja: 'スープ' },
    FOOD: { zh: '餐點', en: 'Food', ja: 'フード' },
    SNACK: { zh: '點心', en: 'Snack', ja: 'おやつ' },
  };
  const uid = () => 'm_' + Math.random().toString(36).slice(2, 10);

  function coerceAlcohol(item) {
    if (item.cat === 'ALCOHOL') return true;
    if (item.note && String(item.note).includes('含酒精')) return true;
    return !!item.alcohol;
  }

  function normalizeItem(raw) {
    const cat = CATS.includes(raw.cat) ? raw.cat : 'FOOD';
    const venue = VENUES.includes(raw.venue) ? raw.venue : 'CAFE';
    const price = Number(raw.price); const emo = Number(raw.emo);
    return {
      id: raw.id || uid(),
      venue,
      cat,
      zh: String(raw.zh || '').trim(),
      en: String(raw.en || '').trim(),
      price: Number.isFinite(price) ? price : 0,
      emo: Number.isFinite(emo) ? emo : 0,
      note: String(raw.note || '').trim(),
      alcohol: coerceAlcohol({ ...raw, cat }),
      published: raw.published === true,
      sort: Number.isFinite(Number(raw.sort)) ? Number(raw.sort) : 0,
    };
  }

  function parseMenuDoc(value) {
    if (!value || !String(value).trim()) return { version: 1, updated_at: null, items: [] };
    try {
      const j = JSON.parse(value);
      const items = Array.isArray(j.items) ? j.items.map(normalizeItem) : [];
      return { version: Number(j.version) || 1, updated_at: j.updated_at || null, items };
    } catch {
      return { version: 1, updated_at: null, items: [] };
    }
  }

  function validateDoc(doc) {
    if (!doc || !Array.isArray(doc.items)) return { ok: false, error: '格式錯誤' };
    if (JSON.stringify(doc).length > 500000) return { ok: false, error: '菜單資料過大' };
    for (const it of doc.items) {
      if (!it.zh) return { ok: false, error: '品名（中）必填' };
      if (!VENUES.includes(it.venue)) return { ok: false, error: '店別無效' };
      if (!CATS.includes(it.cat)) return { ok: false, error: '分類無效' };
      if (!(it.price >= 0) || !(it.emo >= 0)) return { ok: false, error: '價格無效' };
    }
    return { ok: true };
  }

  function touch(doc) {
    return { ...doc, version: doc.version || 1, updated_at: new Date().toISOString(), items: doc.items.slice() };
  }

  function upsertItem(doc, raw) {
    const item = normalizeItem(raw);
    const next = touch(doc);
    const i = next.items.findIndex(x => x.id === item.id);
    if (i >= 0) next.items[i] = item; else next.items.push(item);
    return next;
  }

  function removeItem(doc, id) {
    const next = touch(doc);
    next.items = next.items.filter(x => x.id !== id);
    return next;
  }

  function publishedOnly(doc) {
    return (doc.items || []).filter(x => x.published);
  }

  function fromSeedRows(rows) {
    const items = (rows || []).map((r, i) => normalizeItem({
      ...r,
      published: false,
      sort: (i + 1) * 10,
      alcohol: r.alcohol === true || r.cat === 'ALCOHOL' || (r.note && String(r.note).includes('含酒精')),
    }));
    return touch({ version: 1, items });
  }

  function stringifyDoc(doc) {
    return JSON.stringify(doc);
  }

  function sortItems(items) {
    return items.slice().sort((a, b) => {
      const va = VENUES.indexOf(a.venue) - VENUES.indexOf(b.venue);
      if (va !== 0) return va;
      const ca = CATS.indexOf(a.cat) - CATS.indexOf(b.cat);
      if (ca !== 0) return ca;
      return (a.sort - b.sort) || a.zh.localeCompare(b.zh, 'zh-Hant');
    });
  }

  /* ---- 前台 HTML（space 頁三語共用） ---- */
  const esc = s => (s == null ? '' : String(s)).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const money = n => 'NT$' + Number(n || 0).toLocaleString('zh-TW');
  const ORIG_LABEL = { zh: '原價', en: 'Was', ja: '定価' };
  const pick = (label, lang) => label[lang] || label.zh;

  function groupBy(items, key) {
    const map = {}; const order = [];
    items.forEach(it => { if (!map[it[key]]) { map[it[key]] = []; order.push(it[key]); } map[it[key]].push(it); });
    return order.map(k => [k, map[k]]);
  }

  function renderItem(item, lang) {
    const showOrig = item.emo > 0 && item.emo !== item.price;
    const priceHtml = showOrig
      ? '<span class="now">' + money(item.emo) + '</span><span class="orig">' + pick(ORIG_LABEL, lang) + ' <s>' + money(item.price) + '</s></span>'
      : '<span class="now">' + money(item.price) + '</span>';
    return '<li class="menu-item"><div class="menu-item__names">' +
      '<span class="menu-item__zh">' + esc(item.zh) + '</span>' +
      (item.en ? '<span class="menu-item__en">' + esc(item.en) + '</span>' : '') +
      (item.note ? '<div class="menu-item__note">' + esc(item.note) + '</div>' : '') +
      '</div><div class="menu-item__price">' + priceHtml + '</div></li>';
  }

  function renderGroup(cat, items, lang) {
    const label = CAT_LABEL[cat] || { zh: cat, en: '', ja: cat };
    const sub = lang === 'zh' ? label.en : '';
    return '<section class="menu-group"><div class="menu-group__head">' +
      '<h3 class="menu-group__zh">' + esc(pick(label, lang)) + '</h3>' +
      (sub ? '<span class="menu-group__en">' + esc(sub) + '</span>' : '') +
      '</div><ul class="menu-list">' + items.map(it => renderItem(it, lang)).join('') + '</ul></section>';
  }

  // items 須已 sortItems；依店別（在咖啡／三點水）再依分類分組
  function renderMenuHtml(items, lang, emptyText) {
    lang = lang || 'zh';
    if (!items || !items.length) return '<p class="menu-empty">' + esc(emptyText || '') + '</p>';
    let html = groupBy(items, 'venue').map(([venue, list]) => {
      const label = VENUE_LABEL[venue] || { zh: venue, en: '' };
      const title = lang === 'en' ? label.en : label.zh;
      const sub = lang === 'en' ? label.zh : label.en;
      return '<section class="menu-venue" id="menu-' + venue.toLowerCase() + '"><h2 class="menu-venue__title">' +
        esc(title) + '<span class="menu-venue__sub">' + esc(sub) + '</span></h2>' +
        groupBy(list, 'cat').map(([cat, l]) => renderGroup(cat, l, lang)).join('') + '</section>';
    }).join('');
    if (items.some(it => it.alcohol)) {
      html += '<p class="menu-notice">未滿十八歲禁止飲酒。禁止酒駕。 / No alcohol under 18. Don\'t drink and drive.</p>';
    }
    return html;
  }

  global.MenuLib = {
    CATS, VENUES, CAT_LABEL, VENUE_LABEL, uid, normalizeItem, parseMenuDoc, validateDoc,
    upsertItem, removeItem, publishedOnly, fromSeedRows, stringifyDoc, sortItems, touch, renderMenuHtml,
  };
})(typeof window !== 'undefined' ? window : globalThis);
