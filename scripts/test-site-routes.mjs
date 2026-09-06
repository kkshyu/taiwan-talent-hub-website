// SITE_AUDIT_ORIGIN=http://127.0.0.1:18081 node --test scripts/test-site-routes.mjs
// 只讀 loopback 網站，未設定來源時跳過 HTTP，讓一般 npm test 不依賴伺服器。
import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

function localOrigin(value) {
  const url = new URL(value);
  assert.ok(['http:', 'https:'].includes(url.protocol));
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'SITE_AUDIT_ORIGIN must be loopback');
  assert.ok(!url.username && !url.password && url.pathname === '/' && !url.search && !url.hash);
  return url.origin;
}

test('route audit rejects non-loopback origins and credentials', () => {
  assert.equal(localOrigin('http://127.0.0.1:18081'), 'http://127.0.0.1:18081');
  for (const origin of ['https://www.emoji.tw', 'http://127.0.0.1.evil.test', 'http://user@localhost:18081']) {
    assert.throws(() => localOrigin(origin));
  }
});

test('three-language pages, local assets, redirects and missing events', { skip: !process.env.SITE_AUDIT_ORIGIN }, async () => {
  const origin = localOrigin(process.env.SITE_AUDIT_ORIGIN);
  const prefixes = ['', '/en', '/ja'];
  const slugs = ['', 'about', 'system', 'space', 'events', 'member', 'access', 'fellow', 'startup', 'cis/'];
  const pages = prefixes.flatMap(pre => slugs.map(slug => `${pre}/${slug}`));
  const extraPages = ['/admin', '/access-mock', '/ig-render', ...prefixes.map(pre => pre + '/event-application')];
  const assets = new Set();
  const checkedAssets = new Set();
  const summary = { pages: 0, extraPages: 0, missingEventPages: 0, missingEventApi: 0, redirects: 0, localAssets: 0, securityHeaders: 0, hstsHeaders: 0 };

  async function request(route) {
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch(new URL(route, origin), { redirect: 'manual', signal: AbortSignal.timeout(10000) });
        assert.equal(res.headers.get('x-content-type-options'), 'nosniff', route);
        assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN', route);
        assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin', route);
        assert.match(res.headers.get('content-security-policy') || '', /object-src 'none'/, route);
        assert.match(res.headers.get('content-security-policy') || '', /frame-ancestors 'self'/, route);
        assert.equal(res.headers.get('x-powered-by'), null, route);
        summary.securityHeaders++;
        if (res.headers.has('strict-transport-security')) summary.hstsHeaders++;
        return res;
      } catch (error) {
        if (attempt >= 2 || error instanceof assert.AssertionError) throw error;
        await delay(500);
      }
    }
  }

  function collectAssets(source, route) {
    const values = [
      ...[...source.matchAll(/\b(?:src|href|poster)\s*=\s*["']([^"'<>]+)["']/gi)].map(match => match[1]),
      ...[...source.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/gi)].map(match => match[1]),
      ...[...source.matchAll(/["'](\/[a-z0-9_./-]+\.(?:js|css|svg|png|jpe?g|webp))["']/gi)].map(match => match[1]),
    ];
    for (const value of values) {
      if (!value || value.startsWith('#') || /[${}<>]/.test(value)) continue;
      const url = new URL(value.replaceAll('&amp;', '&'), new URL(route, origin));
      if (url.origin !== origin || !/\.(?:css|js|mjs|png|svg|jpe?g|webp|gif|ico|avif|woff2?|ttf|otf|mp4|pdf|zip)$/i.test(url.pathname)) continue;
      assets.add(url.pathname + url.search);
    }
  }

  for (const route of [...pages, ...extraPages, ...prefixes.map(pre => pre + '/events/__audit_missing_event__')]) {
    const res = await request(route);
    assert.equal(res.status, 200, route);
    assert.match(res.headers.get('content-type') || '', /text\/html/, route);
    const html = await res.text();
    assert.doesNotMatch(html, /<!--SITE_(HEADER|FOOTER)-->/, route);
    collectAssets(html, route);
    if (pages.includes(route)) summary.pages++;
    else if (extraPages.includes(route)) summary.extraPages++;
    else { assert.match(res.headers.get('x-robots-tag') || '', /noindex/, route); summary.missingEventPages++; }
  }
  for (const pre of prefixes) {
    for (const slash of ['', '/']) {
      const route = pre + '/menu' + slash;
      const res = await request(route);
      assert.equal(res.status, 301, route);
      assert.equal(res.headers.get('location'), pre + '/space#menu', route);
      await res.body?.cancel();
      summary.redirects++;
    }
  }
  const missing = await request('/api/events/__audit_missing_event__');
  assert.equal(missing.status, 404);
  assert.match(missing.headers.get('cache-control') || '', /no-store/);
  await missing.body?.cancel(); // 不讀取或輸出 API 內容。
  summary.missingEventApi++;

  for (const route of assets) {
    if (checkedAssets.has(route)) continue;
    const res = await request(route);
    assert.equal(res.status, 200, route);
    assert.doesNotMatch(res.headers.get('content-type') || '', /text\/html/, route);
    checkedAssets.add(route);
    if (/\.(?:css|js|mjs|svg)(?:\?|$)/i.test(route)) collectAssets(await res.text(), route);
    else await res.body?.cancel();
  }
  summary.localAssets = checkedAssets.size;
  console.log(JSON.stringify(summary));
});
