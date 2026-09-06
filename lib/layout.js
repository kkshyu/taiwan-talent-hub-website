'use strict';
/**
 * 全站 header／footer 組裝：讀 partial、依路徑填語系與 aria-current，替換頁面標記。
 * 標記：<!--SITE_HEADER--> <!--SITE_FOOTER-->
 */
const fs = require('fs');
const path = require('path');

const PARTIALS_DIR = path.join(__dirname, '..', 'views', 'partials');
const MARKER_HEADER = '<!--SITE_HEADER-->';
const MARKER_FOOTER = '<!--SITE_FOOTER-->';
const CURRENT = ' aria-current="page"';

const TRAILING_SLASH = new Set(['cis']);
const PROGRAMS = new Set(['fellow', 'partner', 'startup']);
const SITE_ORIGIN = 'https://www.emoji.tw';
const DYNAMIC_META = {
  events: {
    zh: ['活動｜言文字・台灣人才聚落', '查看近期講座、交流與主題活動，選擇場次並完成報名。'],
    en: ['Events | emoji — Taiwan Talent Hub', 'Browse upcoming talks, networking gatherings and themed events, then choose a session and register.'],
    ja: ['イベント｜言文字・台湾タレントハブ', '講座、交流会、テーマイベントを確認し、参加する回を選んでお申し込みください。'],
  },
  'event-application': {
    zh: ['申請三樓社群活動場地｜言文字', '申請言文字三樓社群活動場地，提出活動內容、人數、希望時段與設備需求，再確認安排。'],
    en: ['Apply for the 3F community event venue | emoji', 'Apply to host a community event on emoji\'s 3F venue, then confirm timing, fees and terms with our team.'],
    ja: ['3Fコミュニティイベント会場の利用申請｜言文字', '言文字3Fでコミュニティイベントを開催するため、内容、人数、希望日時、設備の希望をお知らせください。'],
  },
};

let cache = null;
const pageCache = new Map();

function readPage(absPath) {
  if (process.env.NODE_ENV !== 'production') return fs.readFileSync(absPath, 'utf8');
  // 靜態頁面隨部署重啟更新；只快取實際讀到的檔案，不依任意請求網址增加項目。
  if (!pageCache.has(absPath)) pageCache.set(absPath, fs.readFileSync(absPath, 'utf8'));
  return pageCache.get(absPath);
}

function loadPartials() {
  const out = {};
  for (const lang of ['zh', 'en', 'ja']) {
    out[lang] = {
      header: fs.readFileSync(path.join(PARTIALS_DIR, `header-${lang}.html`), 'utf8'),
      footer: fs.readFileSync(path.join(PARTIALS_DIR, `footer-${lang}.html`), 'utf8'),
    };
  }
  return out;
}

function getPartials() {
  if (process.env.NODE_ENV !== 'production') return loadPartials();
  if (!cache) cache = loadPartials();
  return cache;
}

/** @returns {{ lang: 'zh'|'en'|'ja', slug: string, zh: string, en: string, ja: string }} */
function localePaths(reqPath) {
  let p = String(reqPath || '/').split('?')[0];
  if (p.length > 1) p = p.replace(/\/+$/, '');
  if (!p) p = '/';

  let lang = 'zh';
  let rest = p;
  if (p === '/en' || p.startsWith('/en/')) {
    lang = 'en';
    rest = p.slice(3) || '/';
  } else if (p === '/ja' || p.startsWith('/ja/')) {
    lang = 'ja';
    rest = p.slice(3) || '/';
  }
  if (!rest.startsWith('/')) rest = '/' + rest;
  if (rest.length > 1) rest = rest.replace(/\/+$/, '');
  const slug = rest === '/' ? '' : rest.replace(/^\//, '');

  // space.html → slug space（與 /space 一致）
  const normSlug =
    slug === 'space.html' ? 'space'
    : slug === 'member.html' ? 'member'
    : slug === 'system.html' ? 'system'
    : slug === 'about.html' ? 'about'
    : slug;

  const pathFor = (L, s) => {
    if (!s) return L === 'zh' ? '/' : `/${L}/`;
    const slash = TRAILING_SLASH.has(s) ? '/' : '';
    return L === 'zh' ? `/${s}${slash}` : `/${L}/${s}${slash}`;
  };

  if (normSlug === 'space' || normSlug === 'menu' || normSlug === 'member' || normSlug === 'system' || normSlug === 'about') {
    return {
      lang,
      slug: normSlug,
      zh: pathFor('zh', normSlug),
      en: pathFor('en', normSlug),
      ja: pathFor('ja', normSlug),
    };
  }

  return {
    lang,
    slug,
    zh: pathFor('zh', slug),
    en: pathFor('en', slug),
    ja: pathFor('ja', slug),
  };
}

function fill(tpl, vars) {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(v);
  }
  return out;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function localizeDynamicHead(html, reqPath, meta) {
  const kind = meta.slug === 'event-application' ? 'event-application'
    : meta.slug === 'events' || meta.slug.startsWith('events/') ? 'events'
    : '';
  if (!kind) return html;

  const [title, description] = DYNAMIC_META[kind][meta.lang];
  const currentPath = meta[meta.lang];
  const canonical = SITE_ORIGIN + currentPath;
  const locale = meta.lang === 'zh' ? 'zh_TW' : meta.lang === 'ja' ? 'ja_JP' : 'en_US';
  const alternates = ['zh_TW', 'en_US', 'ja_JP'].filter(item => item !== locale);
  const head = [
    `<link rel="canonical" href="${escapeHtml(canonical)}">`,
    `<link rel="alternate" hreflang="zh-Hant" href="${SITE_ORIGIN + escapeHtml(meta.zh)}">`,
    `<link rel="alternate" hreflang="en" href="${SITE_ORIGIN + escapeHtml(meta.en)}">`,
    `<link rel="alternate" hreflang="ja" href="${SITE_ORIGIN + escapeHtml(meta.ja)}">`,
    `<link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN + escapeHtml(meta.zh)}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:url" content="${escapeHtml(canonical)}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    '<meta property="og:site_name" content="言文字・台灣人才聚落">',
    `<meta property="og:locale" content="${locale}">`,
    ...alternates.map(item => `<meta property="og:locale:alternate" content="${item}">`),
    `<meta property="og:image" content="${SITE_ORIGIN}/og-cover.jpg">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    `<meta name="twitter:image" content="${SITE_ORIGIN}/og-cover.jpg">`,
  ].join('\n');

  return html
    .replace(/<html\b[^>]*\blang=(['"])[^'"]*\1/i, match => match.replace(/lang=(['"])[^'"]*\1/i, `lang="${meta.lang === 'zh' ? 'zh-Hant' : meta.lang}"`))
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta\s+name=(['"])description\1\s+content=(['"])[\s\S]*?\2\s*\/?>/i, `<meta name="description" content="${escapeHtml(description)}">`)
    .replace('</head>', `${head}\n</head>`);
}

function composeEventMeta(html, event, reqPath) {
  if (!event || event.visibility !== 'public') return html;
  const meta = localePaths(reqPath);
  const canonical = SITE_ORIGIN + meta[meta.lang];
  const title = `${event.title}｜${DYNAMIC_META.events[meta.lang][0]}`;
  const description = String(event.description || DYNAMIC_META.events[meta.lang][1]).replace(/\s+/g, ' ').trim().slice(0, 180);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: String(event.title),
    description,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: { '@type': 'Place', name: String(event.location || '言文字・台灣人才聚落'), address: '台北市中正區重慶南路一段 11 號' },
    url: canonical,
  };
  if (event.starts_at_iso) schema.startDate = `${event.starts_at_iso}:00+08:00`;
  if (event.ends_at_iso) schema.endDate = `${event.ends_at_iso}:00+08:00`;
  if (event.price_twd != null) schema.offers = {
    '@type': 'Offer', price: Number(event.price_twd), priceCurrency: 'TWD',
    availability: 'https://schema.org/InStock', url: canonical,
  };
  const json = JSON.stringify(schema).replace(/</g, '\\u003c');
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*">/i, `<meta name="description" content="${escapeHtml(description)}">`)
    .replace(/<meta\s+property="og:type"\s+content="website">/i, '<meta property="og:type" content="event">')
    .replace(/<meta\s+property="og:title"\s+content="[^"]*">/i, `<meta property="og:title" content="${escapeHtml(title)}">`)
    .replace(/<meta\s+property="og:description"\s+content="[^"]*">/i, `<meta property="og:description" content="${escapeHtml(description)}">`)
    .replace(/<meta\s+name="twitter:title"\s+content="[^"]*">/i, `<meta name="twitter:title" content="${escapeHtml(title)}">`)
    .replace(/<meta\s+name="twitter:description"\s+content="[^"]*">/i, `<meta name="twitter:description" content="${escapeHtml(description)}">`)
    .replace('</head>', `<script type="application/ld+json">${json}</script>\n</head>`);
}

function composeLayout(html, reqPath) {
  if (!html || (!html.includes(MARKER_HEADER) && !html.includes(MARKER_FOOTER))) {
    return html;
  }
  const meta = localePaths(reqPath);
  const partials = getPartials();
  const pack = partials[meta.lang] || partials.zh;

  const attr = value => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const vars = {
    LANG_ZH: attr(meta.zh),
    LANG_EN: attr(meta.en),
    LANG_JA: attr(meta.ja),
    LANG_ZH_CURRENT: meta.lang === 'zh' ? CURRENT : '',
    LANG_EN_CURRENT: meta.lang === 'en' ? CURRENT : '',
    LANG_JA_CURRENT: meta.lang === 'ja' ? CURRENT : '',
    NAV_FELLOW_CURRENT: meta.slug === 'fellow' ? CURRENT : '',
    NAV_PARTNER_CURRENT: meta.slug === 'partner' ? CURRENT : '',
    NAV_STARTUP_CURRENT: meta.slug === 'startup' ? CURRENT : '',
    NAV_SPACE_CURRENT: meta.slug === 'space' ? CURRENT : '',
    NAV_CIS_CURRENT: meta.slug === 'cis' ? CURRENT : '',
    NAV_MEMBER_CURRENT: meta.slug === 'member' ? CURRENT : '',
    NAV_SYSTEM_CURRENT: meta.slug === 'system' ? CURRENT : '',
    NAV_ABOUT_CURRENT: meta.slug === 'about' ? CURRENT : '',
    NAV_ACCESS_CURRENT: meta.slug === 'access' ? CURRENT : '',
    NAV_EVENTS_CURRENT: meta.slug === 'events' || meta.slug.startsWith('events/') || meta.slug === 'event-application' ? CURRENT : '',
  };

  let out = html;
  if (out.includes(MARKER_HEADER)) {
    out = out.split(MARKER_HEADER).join(fill(pack.header, vars));
  }
  if (out.includes(MARKER_FOOTER)) {
    out = out.split(MARKER_FOOTER).join(fill(pack.footer, vars));
  }
  return localizeDynamicHead(out, reqPath, meta);
}

function hasLayoutMarkers(html) {
  return html.includes(MARKER_HEADER) || html.includes(MARKER_FOOTER);
}

/**
 * 將 URL pathname 對應到 public/ 下的 HTML 檔（若存在）。
 * @param {string} pubRoot absolute path to public/
 * @param {string} reqPath
 * @returns {string|null} absolute file path
 */
function resolvePublicHtml(pubRoot, reqPath) {
  pubRoot = path.resolve(pubRoot);
  let p = String(reqPath || '/').split('?')[0];
  if (p.length > 1) p = p.replace(/\/+$/, '');
  if (!p) p = '/';

  const candidates = [];
  if (p === '/') {
    candidates.push(path.join(pubRoot, 'index.html'));
  } else if (/\.html?$/i.test(p)) {
    candidates.push(path.join(pubRoot, p.replace(/^\//, '')));
  } else {
    const rel = p.replace(/^\//, '');
    candidates.push(path.join(pubRoot, rel + '.html'));
    candidates.push(path.join(pubRoot, rel, 'index.html'));
  }

  for (const abs of candidates) {
    const relative = path.relative(pubRoot, abs);
    if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) continue;
    try {
      if (fs.statSync(abs).isFile()) return abs;
    } catch { /* miss */ }
  }
  return null;
}

function sendPage(res, absPath, reqPath, transform) {
  const raw = readPage(absPath);
  let html = composeLayout(raw, reqPath);
  if (transform) html = transform(html);
  res.type('html').send(html);
}

/** Express middleware：若路徑對應含標記的 HTML，組裝後送出；否則 next()。 */
function layoutMiddleware(pubRoot) {
  return function layoutMw(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    // 略過 API 與明顯靜態副檔名
    if (req.path.startsWith('/api')) return next();
    if (/\.[a-z0-9]+$/i.test(req.path) && !/\.html?$/i.test(req.path)) return next();

    const abs = resolvePublicHtml(pubRoot, req.path);
    if (!abs) return next();
    let raw;
    try { raw = readPage(abs); } catch { return next(); }
    if (!hasLayoutMarkers(raw)) return next();
    res.type('html').send(composeLayout(raw, req.path));
  };
}

module.exports = {
  composeLayout,
  composeEventMeta,
  localePaths,
  sendPage,
  layoutMiddleware,
  resolvePublicHtml,
  hasLayoutMarkers,
  MARKER_HEADER,
  MARKER_FOOTER,
  PROGRAMS,
};
