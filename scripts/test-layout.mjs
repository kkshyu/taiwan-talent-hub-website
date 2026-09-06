// scripts/test-layout.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  composeLayout, composeEventMeta, localePaths, resolvePublicHtml, MARKER_HEADER, MARKER_FOOTER,
} = require('../lib/layout.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(__dirname, '..', 'public');

test('localePaths maps home locales', () => {
  assert.deepEqual(localePaths('/'), { lang: 'zh', slug: '', zh: '/', en: '/en/', ja: '/ja/' });
  assert.equal(localePaths('/en/').lang, 'en');
  assert.equal(localePaths('/en').zh, '/');
  assert.equal(localePaths('/ja/fellow').ja, '/ja/fellow');
});

test('localePaths maps programs and cis slash', () => {
  assert.equal(localePaths('/fellow').slug, 'fellow');
  assert.equal(localePaths('/en/partner').en, '/en/partner');
  assert.equal(localePaths('/cis').zh, '/cis/');
  assert.equal(localePaths('/en/cis/').en, '/en/cis/');
});

test('localePaths maps about locales', () => {
  assert.equal(localePaths('/about').slug, 'about');
  assert.equal(localePaths('/about').zh, '/about');
  assert.equal(localePaths('/en/about').en, '/en/about');
  assert.equal(localePaths('/ja/about').ja, '/ja/about');
  assert.equal(localePaths('/about.html').slug, 'about');
});

test('header and footer link to /about not /#about', () => {
  for (const lang of ['zh', 'en', 'ja']) {
    const h = fs.readFileSync(path.join(__dirname, '..', 'views', 'partials', `header-${lang}.html`), 'utf8');
    const f = fs.readFileSync(path.join(__dirname, '..', 'views', 'partials', `footer-${lang}.html`), 'utf8');
    assert.doesNotMatch(h, /\/#about/);
    assert.doesNotMatch(f, /\/#about/);
    assert.match(h, /NAV_ABOUT_CURRENT/);
    if (lang === 'zh') {
      assert.match(h, /href="\/about"/);
      assert.match(f, /href="\/about"/);
    } else {
      assert.match(h, new RegExp(`href="/${lang}/about"`));
      assert.match(f, new RegExp(`href="/${lang}/about"`));
    }
  }
});

test('composeLayout about page marks about current', () => {
  const raw = `<!doctype html><body>${MARKER_HEADER}<main></main>${MARKER_FOOTER}</body>`;
  const html = composeLayout(raw, '/about');
  assert.match(html, /href="\/about"[^>]*aria-current="page"/);
  assert.doesNotMatch(html, /href="\/#about"/);
});

test('localePaths maps member menu and space locales', () => {
  const m = localePaths('/member');
  assert.equal(m.lang, 'zh');
  assert.equal(m.zh, '/member');
  assert.equal(m.en, '/en/member');
  assert.equal(m.ja, '/ja/member');
  assert.equal(localePaths('/en/member').lang, 'en');
  assert.equal(localePaths('/en/member').en, '/en/member');
  assert.equal(localePaths('/ja/member').ja, '/ja/member');
  assert.equal(localePaths('/menu/').zh, '/menu');
  assert.equal(localePaths('/menu').en, '/en/menu');
  assert.equal(localePaths('/en/menu/').en, '/en/menu');
  assert.equal(localePaths('/ja/menu/').ja, '/ja/menu');
  assert.equal(localePaths('/space').slug, 'space');
  assert.equal(localePaths('/space').zh, '/space');
  assert.equal(localePaths('/en/space').en, '/en/space');
  assert.equal(localePaths('/ja/space').ja, '/ja/space');
  assert.equal(localePaths('/space.html').slug, 'space');
});

test('localePaths maps system locales', () => {
  assert.equal(localePaths('/system').slug, 'system');
  assert.equal(localePaths('/system').zh, '/system');
  assert.equal(localePaths('/en/system').en, '/en/system');
  assert.equal(localePaths('/ja/system').ja, '/ja/system');
  assert.equal(localePaths('/system.html').slug, 'system');
});

test('composeLayout system page marks system current', () => {
  const raw = `<!doctype html><body>${MARKER_HEADER}<main></main>${MARKER_FOOTER}</body>`;
  const html = composeLayout(raw, '/system');
  assert.match(html, /href="\/system"[^>]*aria-current="page"/);
});

test('composeLayout event list and detail mark events current', () => {
  const raw = `<!doctype html><body>${MARKER_HEADER}<main></main>${MARKER_FOOTER}</body>`;
  assert.match(composeLayout(raw, '/events'), /href="\/events"[^>]*aria-current="page"/);
  assert.match(composeLayout(raw, '/en/events/private-demo'), /href="\/en\/events"[^>]*aria-current="page"/);
  assert.equal(localePaths('/ja/events/private-demo').ja, '/ja/events/private-demo');
});

test('shared event pages return localized metadata before JavaScript runs', () => {
  const raw = `<!doctype html><html lang="zh-Hant"><head><title>活動</title><meta name="description" content="中文"></head><body>${MARKER_HEADER}${MARKER_FOOTER}</body></html>`;
  const list = composeLayout(raw, '/en/events');
  assert.match(list, /<html lang="en">/);
  assert.match(list, /<title>Events \| emoji/);
  assert.match(list, /canonical" href="https:\/\/www\.emoji\.tw\/en\/events"/);
  assert.match(list, /hreflang="zh-Hant" href="https:\/\/www\.emoji\.tw\/events"/);
  assert.match(list, /property="og:title" content="Events/);

  const application = composeLayout(raw, '/ja/event-application');
  assert.match(application, /<html lang="ja">/);
  assert.match(application, /<title>3Fコミュニティイベント会場の利用申請/);
  assert.match(application, /canonical" href="https:\/\/www\.emoji\.tw\/ja\/event-application"/);
});

test('public event detail has event metadata and safe JSON-LD', () => {
  const raw = `<!doctype html><html lang="zh-Hant"><head><title>活動</title><meta name="description" content="中文"></head><body>${MARKER_HEADER}${MARKER_FOOTER}</body></html>`;
  const base = composeLayout(raw, '/en/events/demo');
  const html = composeEventMeta(base, {
    title: 'Meet <Build>', description: 'A practical meetup.', visibility: 'public',
    location: '3F', starts_at_iso: '2026-11-08T14:00', ends_at_iso: '2026-11-08T16:00', price_twd: 200,
  }, '/en/events/demo');
  assert.match(html, /<title>Meet &lt;Build&gt;｜Events/);
  assert.match(html, /property="og:type" content="event"/);
  assert.match(html, /"@type":"Event"/);
  assert.match(html, /"startDate":"2026-11-08T14:00:00\+08:00"/);
  assert.match(html, /"price":200/);
  assert.doesNotMatch(html, /<title>Meet <Build>/);
  assert.equal(composeEventMeta(base, { visibility: 'private' }, '/en/events/private'), base);
});

test('composeLayout injects header and footer with aria-current', () => {
  const raw = `<!doctype html><body>${MARKER_HEADER}<main></main>${MARKER_FOOTER}</body>`;
  const html = composeLayout(raw, '/en/fellow');
  assert.match(html, /class="site-nav"/);
  assert.match(html, /class="site-foot"/);
  assert.doesNotMatch(html, /SITE_HEADER/);
  assert.match(html, /href="\/en\/fellow"[^>]*aria-current="page"/);
  assert.match(html, /hreflang="en"[^>]*aria-current="page"/);
  assert.match(html, /href="\/fellow"/);
});

test('composeLayout passes through unmarked html', () => {
  const raw = '<html><body><header class="a-top">x</header></body></html>';
  assert.equal(composeLayout(raw, '/admin'), raw);
});

test('resolvePublicHtml resolves known pages', () => {
  assert.ok(resolvePublicHtml(PUB, '/').endsWith('index.html'));
  assert.ok(resolvePublicHtml(PUB, '/member').endsWith('member.html'));
  assert.ok(resolvePublicHtml(PUB, '/fellow').includes(`${path.sep}fellow${path.sep}index.html`));
});

test('header partials prioritize visitor tasks and keep brand material in the footer', () => {
  const expect = {
    zh: { label: '會員方案', prefix: '' },
    en: { label: 'Membership', prefix: '/en' },
    ja: { label: '会員プラン', prefix: '/ja' },
  };
  for (const lang of ['zh', 'en', 'ja']) {
    const h = fs.readFileSync(path.join(__dirname, '..', 'views', 'partials', `header-${lang}.html`), 'utf8');
    assert.doesNotMatch(h, /href="[^"]*\/menu/);
    assert.doesNotMatch(h, /#floors/);
    assert.doesNotMatch(h, /\/cis\/|Programs|聚落計畫|プログラム/);
    assert.match(h, /NAV_SYSTEM_CURRENT/);
    assert.match(h, new RegExp(`href="${expect[lang].prefix}/system"[^>]*>\\s*${expect[lang].label}`));
    const positions = ['space', 'system', 'events', 'partner', 'access', 'about'].map(slug => h.indexOf(`href="${expect[lang].prefix}/${slug}"`));
    assert.ok(positions.every((position, index) => position >= 0 && (!index || position > positions[index - 1])), `${lang} nav order`);
    assert.match(h, new RegExp(`href="${expect[lang].prefix}/fellow" class="btn"`));
  }
});

test('composeLayout access page marks directions current', () => {
  const raw = `<!doctype html><body>${MARKER_HEADER}<main></main>${MARKER_FOOTER}</body>`;
  const html = composeLayout(raw, '/access');
  assert.match(html, /href="\/access"[^>]*aria-current="page"/);
});

test('composeLayout space page marks space current', () => {
  const raw = `<!doctype html><body>${MARKER_HEADER}<main></main>${MARKER_FOOTER}</body>`;
  const html = composeLayout(raw, '/space');
  assert.match(html, /href="\/space"[^>]*aria-current="page"/);
  assert.doesNotMatch(html, /\/menu\//);
});

test('source pages use markers', () => {
  const index = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
  const member = fs.readFileSync(path.join(PUB, 'member.html'), 'utf8');
  assert.match(index, /SITE_HEADER/);
  assert.match(index, /SITE_FOOTER/);
  assert.match(member, /SITE_HEADER/);
  assert.match(member, /SITE_FOOTER/);
  assert.doesNotMatch(member, /m-top|m-foot/);
});

test('member page has redesign markers', () => {
  const member = fs.readFileSync(path.join(PUB, 'member.html'), 'utf8');
  assert.match(member, /m-access-chip|m-chip/);
  assert.match(member, /m-qr-overlay/);
  assert.match(member, /m-notice/);
  assert.match(member, /m-panel--wallet|ptsAvailable|walletTitle/);
  assert.match(member, /m-toast/);
  assert.doesNotMatch(member, /申購|本金|持倉|贖回/);
  assert.doesNotMatch(member, /Principal left|残元本/);
});

test('about zh page structure', () => {
  const html = fs.readFileSync(path.join(PUB, 'about.html'), 'utf8');
  assert.match(html, /SITE_HEADER/);
  assert.match(html, /SITE_FOOTER/);
  assert.match(html, /id="why"/);
  assert.match(html, /id="kk"/);
  assert.match(html, /about\.css/);
  assert.match(html, /href="\/space"/);
  assert.match(html, /href="\/fellow#about"/);
  assert.doesNotMatch(html, /旅館|hotel|住宿|過夜/i);
  assert.doesNotMatch(html, /哈哈|～～/);
});

test('resolvePublicHtml resolves about zh', () => {
  assert.ok(resolvePublicHtml(PUB, '/about').endsWith('about.html'));
});

test('system zh page structure', () => {
  const html = fs.readFileSync(path.join(PUB, 'system.html'), 'utf8');
  assert.match(html, /SITE_HEADER/);
  assert.match(html, /SITE_FOOTER/);
  assert.match(html, /system\.css/);
  assert.match(html, /id="overview"/);
  assert.match(html, /id="membership"/);
  assert.match(html, /id="points"/);
  assert.match(html, /id="booking"/);
  assert.match(html, /id="cafe"/);
  assert.match(html, /href="\/fellow"/);
  assert.match(html, /href="\/partner"/);
  assert.match(html, /href="\/space"/);
  assert.match(html, /NT\$\s*4,000|NT\$4,000/);
  assert.doesNotMatch(html, /旅館|hotel|住宿|過夜|共居|居住|入住|酒吧|Cafe &amp; Bar|Cafe & Bar|Member Plaza|Talent Lounge/i);
});

test('resolvePublicHtml resolves system zh', () => {
  assert.ok(resolvePublicHtml(PUB, '/system').endsWith('system.html'));
});

test('system en page structure', () => {
  const html = fs.readFileSync(path.join(PUB, 'en', 'system.html'), 'utf8');
  assert.match(html, /lang="en"/);
  assert.match(html, /id="membership"/);
  assert.match(html, /href="\/en\/fellow"/);
  assert.match(html, /href="\/en\/partner"/);
  assert.match(html, /href="\/en\/space"/);
  assert.match(html, /canonical" href="https:\/\/www\.emoji\.tw\/en\/system"/);
  assert.doesNotMatch(html, /旅館|hotel|住宿|過夜|共居|居住|入住|酒吧|Cafe &amp; Bar|Cafe & Bar|Member Plaza|Talent Lounge/i);
});

test('system ja page structure', () => {
  const html = fs.readFileSync(path.join(PUB, 'ja', 'system.html'), 'utf8');
  assert.match(html, /lang="ja"/);
  assert.match(html, /id="membership"/);
  assert.match(html, /href="\/ja\/fellow"/);
  assert.match(html, /href="\/ja\/partner"/);
  assert.match(html, /href="\/ja\/space"/);
  assert.match(html, /canonical" href="https:\/\/www\.emoji\.tw\/ja\/system"/);
  assert.doesNotMatch(html, /旅館|hotel|宿泊|ホテル|過夜|共居|居住|入住/i);
});

test('plan choices, venue enquiries and account limits are explicit in all locales', () => {
  const pages = [
    ['system.html', 'data-label="適合情境"', '11 月 1 日正式開幕後開放', '/event-application', '24 小時（條件式啟用）'],
    [path.join('en', 'system.html'), 'data-label="Best for"', 'Available after the November 1 grand opening', '/en/event-application', '24-hour access (conditional)'],
    [path.join('ja', 'system.html'), 'data-label="おすすめ"', '11月1日の正式オープン後に利用開始', '/ja/event-application', '24時間利用（条件付き）'],
  ];
  for (const [rel, situation, availability, application, conditionalAccess] of pages) {
    const html = fs.readFileSync(path.join(PUB, rel), 'utf8');
    assert.match(html, /class="system-table membership-table"/);
    assert.ok(html.includes(situation));
    assert.ok(html.includes(availability));
    assert.ok(html.includes(application));
    assert.ok(html.includes(conditionalAccess));
    assert.match(html, /mailto:us@emoji\.tw/);
    assert.doesNotMatch(html, />[^<]*Active[^<]*</);
  }

  const css = fs.readFileSync(path.join(PUB, 'system.css'), 'utf8');
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.membership-table td::before/);

  const events = fs.readFileSync(path.join(PUB, 'events.html'), 'utf8');
  assert.ok(events.indexOf('id="ev-app"') < events.indexOf('id="ev-apply"'));
  assert.match(events, /instagram\.com\/emoji0701/);

  for (const rel of ['member.html', path.join('en', 'member.html'), path.join('ja', 'member.html')]) {
    const html = fs.readFileSync(path.join(PUB, rel), 'utf8');
    assert.match(html, /首次登入會以 Google 已驗證|On first sign-in, we create an account|初回ログイン時/);
    assert.doesNotMatch(html, /activeShort: 'Active'|activeOn: 'Active|activeOff: 'Not Active|非 Active|No active (?:or|plan)|\$\{plan\}(?:進行中|利用中)/);
  }
});

test('partner pages route community events to applications and business events to email', () => {
  const pages = [
    ['partner/index.html', '/event-application', /企業／團隊／客戶活動/],
    [path.join('en', 'partner', 'index.html'), '/en/event-application', /Company, team or client event/i],
    [path.join('ja', 'partner', 'index.html'), '/ja/event-application', /企業・チーム・顧客向け/],
  ];

  for (const [rel, applicationPath, businessMarker] of pages) {
    const html = fs.readFileSync(path.join(PUB, rel), 'utf8');
    const routeBlocks = [...html.matchAll(/<div class="(?:hero-cta|pagenav)"[^>]*>([\s\S]*?)<\/div>/g)]
      .map(match => match[1]);
    assert.ok(routeBlocks.length >= 5, `${rel} repeats both routes at key decisions`);
    for (const block of routeBlocks) {
      assert.ok(block.includes(`href="${applicationPath}"`), `${rel} CTA includes community application`);
      assert.match(block, /href="mailto:us@emoji\.tw\?subject=/, `${rel} CTA includes business email`);
    }

    const cards = [...html.matchAll(/<div class="ptn-brick">([\s\S]*?)<\/p><\/div>/g)]
      .map(match => match[1]);
    const businessCards = cards.filter(card => businessMarker.test(card));
    assert.equal(businessCards.length, 1, `${rel} has one business event card`);
    assert.match(businessCards[0], /href="mailto:us@emoji\.tw\?subject=/);
    assert.ok(!businessCards[0].includes(`href="${applicationPath}"`), `${rel} business card does not use community application`);

    const communityCards = cards.filter(card => !businessMarker.test(card)).slice(0, 5);
    assert.equal(communityCards.length, 5, `${rel} has five community event cards`);
    for (const card of communityCards) {
      assert.ok(card.includes(`href="${applicationPath}"`), `${rel} community card uses venue application`);
      assert.doesNotMatch(card, /href="mailto:us@emoji\.tw/);
    }
  }
});

test('public opening copy and Japanese membership terms match the customer flow', () => {
  const opening = [
    ['access.html', '11 月 1 日正式開幕後'],
    [path.join('en', 'access.html'), 'November 1, 2026 grand opening'],
    [path.join('ja', 'access.html'), '2026年11月1日の正式オープン後'],
  ];
  for (const [rel, expected] of opening) {
    const html = fs.readFileSync(path.join(PUB, rel), 'utf8');
    assert.ok(html.includes(expected));
    assert.doesNotMatch(html, /試營運起|from the soft opening|プレオープンより/);
  }
  const footerOpening = { zh: '11 月 1 日正式開幕後', en: 'November 1 grand opening', ja: '11月1日の正式オープン後' };
  for (const lang of ['zh', 'en', 'ja']) {
    const footer = fs.readFileSync(path.join(__dirname, '..', 'views', 'partials', `footer-${lang}.html`), 'utf8');
    assert.ok(footer.includes(footerOpening[lang]));
    assert.doesNotMatch(footer, /試營運起|from soft opening|プレオープンより/);
  }
  for (const rel of ['member.html', path.join('en', 'member.html'), path.join('ja', 'member.html'), path.join('ja', 'fellow', 'index.html')]) {
    const html = fs.readFileSync(path.join(PUB, rel), 'utf8');
    assert.doesNotMatch(html, /会籍|購入元本/);
  }
});

test('about en page structure', () => {
  const html = fs.readFileSync(path.join(PUB, 'en', 'about.html'), 'utf8');
  assert.match(html, /lang="en"/);
  assert.match(html, /id="why"/);
  assert.match(html, /id="kk"/);
  assert.match(html, /href="\/en\/space"/);
  assert.match(html, /href="\/en\/fellow#about"/);
  assert.match(html, /canonical" href="https:\/\/www\.emoji\.tw\/en\/about"/);
  assert.match(html, /SITE_HEADER/);
  assert.match(html, /about\.css/);
  assert.doesNotMatch(html, /旅館|hotel|住宿|過夜/i);
});

test('resolvePublicHtml resolves about en', () => {
  assert.ok(resolvePublicHtml(PUB, '/en/about').endsWith(`en${path.sep}about.html`));
});

test('about ja page structure', () => {
  const html = fs.readFileSync(path.join(PUB, 'ja', 'about.html'), 'utf8');
  assert.match(html, /lang="ja"/);
  assert.match(html, /id="why"/);
  assert.match(html, /id="kk"/);
  assert.match(html, /href="\/ja\/space"/);
  assert.match(html, /href="\/ja\/fellow#about"/);
  assert.match(html, /canonical" href="https:\/\/www\.emoji\.tw\/ja\/about"/);
  assert.match(html, /SITE_HEADER/);
  assert.match(html, /about\.css/);
  assert.doesNotMatch(html, /旅館|hotel|住宿|過夜|ホテル/i);
});

test('resolvePublicHtml resolves about ja', () => {
  assert.ok(resolvePublicHtml(PUB, '/ja/about').endsWith(`ja${path.sep}about.html`));
});

test('homepages no longer ship #about section', () => {
  for (const rel of ['index.html', path.join('en', 'index.html'), path.join('ja', 'index.html')]) {
    const html = fs.readFileSync(path.join(PUB, rel), 'utf8');
    assert.doesNotMatch(html, /id="about"/);
    assert.doesNotMatch(html, /class="about"/);
  }
});

test('homepage directs first-time visitors by task with labeled concept images', () => {
  for (const rel of ['index.html', path.join('en', 'index.html'), path.join('ja', 'index.html')]) {
    const html = fs.readFileSync(path.join(PUB, rel), 'utf8');
    assert.match(html, /id="floors"/);
    assert.equal((html.match(/class="journey-card reveal"/g) || []).length, 3);
    assert.match(html, /assets\/space\/1f-concept\.jpg/);
    assert.match(html, /assets\/space\/2f-concept\.jpg/);
    assert.match(html, /assets\/space\/3f-concept\.jpg/);
    assert.match(html, /\/system/);
    assert.match(html, /\/space/);
    assert.match(html, /\/events/);
  }
});

test('homepage Offer urls point to /system', () => {
  const zh = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
  assert.match(zh, /emoji\.tw\/system"/);
  assert.doesNotMatch(zh, /emoji\.tw\/#floors"/);
  const en = fs.readFileSync(path.join(PUB, 'en', 'index.html'), 'utf8');
  assert.match(en, /emoji\.tw\/en\/system"/);
  const ja = fs.readFileSync(path.join(PUB, 'ja', 'index.html'), 'utf8');
  assert.match(ja, /emoji\.tw\/ja\/system"/);
});

test('sitemap includes about locales', () => {
  const sm = fs.readFileSync(path.join(PUB, 'sitemap.xml'), 'utf8');
  assert.match(sm, /https:\/\/www\.emoji\.tw\/about/);
  assert.match(sm, /https:\/\/www\.emoji\.tw\/en\/about/);
  assert.match(sm, /https:\/\/www\.emoji\.tw\/ja\/about/);
});

test('sitemap includes system locales', () => {
  const sm = fs.readFileSync(path.join(PUB, 'sitemap.xml'), 'utf8');
  assert.match(sm, /https:\/\/www\.emoji\.tw\/system/);
  assert.match(sm, /https:\/\/www\.emoji\.tw\/en\/system/);
  assert.match(sm, /https:\/\/www\.emoji\.tw\/ja\/system/);
});
