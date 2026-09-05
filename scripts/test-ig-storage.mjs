import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const publisherPath = fileURLToPath(new URL('../lib/ig-publisher.js', import.meta.url));
const require = createRequire(publisherPath);
const source = readFileSync(publisherPath, 'utf8');
const tempRoot = path.resolve(path.dirname(publisherPath), '../../.tmp/minio-fix-20260906');
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x49, 0x47, 0xff, 0xd9]);
const post = { id: '../safe id/01', pages: [{ category: '03', variant: 'a' }, { layout: '03a', fields: {} }] };

// Real AWS SDK and HTTP; only Chromium rendering and the publisher's env are isolated.
function publisher(t, env = {}) {
  mkdirSync(tempRoot, { recursive: true });
  const uploadDir = mkdtempSync(path.join(tempRoot, 'test-'));
  t.after(() => rmSync(uploadDir, { recursive: true, force: true }));
  const screenshots = [];
  let closes = 0;
  const page = {
    async setViewport() {},
    async goto(url) { assert.equal(url, 'http://127.0.0.1:18081/ig-render.html'); },
    async evaluate(_fn, spec) {
      assert.equal(spec.__total, 2);
      return { ok: true, w: 1080, h: 1350 };
    },
    async screenshot(options) {
      screenshots.push(options);
      if (options.path) {
        assert.equal(path.dirname(options.path), uploadDir, 'test writes stay in its own temporary directory');
        writeFileSync(options.path, jpeg);
      }
      return jpeg;
    },
  };
  const module = { exports: {} };
  const context = {
    module, Buffer, URL, URLSearchParams, AbortSignal, setTimeout, clearTimeout,
    process: { env },
    fetch: () => { throw new Error('IG network requests are forbidden in storage tests'); },
    require: name => name === 'puppeteer'
      ? { launch: async () => ({ newPage: async () => page, close: async () => { closes++; } }) }
      : require(name),
  };
  vm.runInNewContext(source, context, { filename: publisherPath });
  return {
    render: () => module.exports.renderPostImages(post, { port: 18081, uploadDir }),
    uploadAsset: (...a) => module.exports.uploadAsset(...a),
    uploadDir, screenshots, closes: () => closes,
  };
}

async function storage(t, status = 200) {
  const requests = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    requests.push({ method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks) });
    res.writeHead(status, { 'Content-Type': 'application/xml', ETag: '"local-test-etag"' });
    res.end(status === 200 ? '' : '<Error><Code>AccessDenied</Code><Message>isolated upload rejected</Message></Error>');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const endpoint = `http://127.0.0.1:${server.address().port}`;
  return { requests, endpoint, env: {
    S3_ENDPOINT: endpoint, S3_ACCESS_KEY: 'local-test-access', S3_SECRET_KEY: 'local-test-secret',
    S3_PUBLIC_BASE: 'https://media.example.test/',
  } };
}

for (const [label, options, bucket, region] of [
  ['defaults', {}, 'ig-media', 'us-east-1'],
  ['configured bucket and region', { S3_BUCKET: 'custom-media', S3_REGION: 'ap-northeast-1' }, 'custom-media', 'ap-northeast-1'],
]) {
  test(`S3 ${label}: real SDK uploads signed JPEGs with stable public URLs`, async t => {
    const remote = await storage(t);
    const app = publisher(t, { ...remote.env, ...options });
    const urls = await app.render();
    assert.deepEqual(Array.from(urls), [1, 2].map(n => `https://media.example.test/${bucket}/posts/ig-safeid01-p${n}.jpg`));
    assert.equal(remote.requests.length, 2);
    for (const [index, req] of remote.requests.entries()) {
      assert.equal(req.method, 'PUT');
      assert.equal(new URL(req.url, remote.endpoint).pathname, `/${bucket}/posts/ig-safeid01-p${index + 1}.jpg`);
      assert.equal(req.headers.host, new URL(remote.endpoint).host, 'bucket must not become a DNS subdomain');
      assert.deepEqual(req.body, jpeg);
      assert.equal(req.headers['content-type'], 'image/jpeg');
      assert.equal(req.headers['content-length'], String(jpeg.length));
      assert.equal(req.headers['content-encoding'], undefined, 'MinIO receives raw JPEG, not aws-chunked encoding');
      assert.equal(req.headers['x-amz-trailer'], undefined);
      assert.match(req.headers.authorization, new RegExp(`^AWS4-HMAC-SHA256 Credential=local-test-access/\\d{8}/${region}/s3/aws4_request,`));
      assert.match(req.headers.authorization, /Signature=[a-f0-9]{64}$/);
      assert.equal(req.headers['x-amz-content-sha256'], createHash('sha256').update(jpeg).digest('hex'));
    }
    assert.ok(app.screenshots.every(shot => !shot.path), 'S3 rendering must not leave local files');
    assert.deepEqual(readdirSync(app.uploadDir), []);
    assert.equal(app.closes(), 1);
  });
}

test('S3 rejection stops remaining pages and closes Chromium', async t => {
  const remote = await storage(t, 403);
  const app = publisher(t, remote.env);
  await assert.rejects(app.render(), /isolated upload rejected|AccessDenied/);
  assert.equal(remote.requests.length, 1);
  assert.equal(app.screenshots.length, 1);
  assert.equal(app.closes(), 1);
  assert.deepEqual(readdirSync(app.uploadDir), []);
});

test('unconfigured S3 keeps the local uploads fallback', async t => {
  const app = publisher(t);
  const urls = await app.render();
  assert.deepEqual(Array.from(urls), [1, 2].map(n => `/uploads/social/ig-safeid01-p${n}.jpg`));
  for (const n of [1, 2]) assert.deepEqual(readFileSync(path.join(app.uploadDir, `ig-safeid01-p${n}.jpg`)), jpeg);
  assert.equal(app.closes(), 1);
});

test('uploadAsset: S3 puts under assets/ and returns public URL; null without S3', async t => {
  const remote = await storage(t);
  const app = publisher(t, remote.env);
  const url = await app.uploadAsset(jpeg, 'site-01.jpg', 'image/jpeg');
  assert.equal(url, 'https://media.example.test/ig-media/assets/site-01.jpg');
  assert.equal(remote.requests.length, 1);
  assert.equal(new URL(remote.requests[0].url, remote.endpoint).pathname, '/ig-media/assets/site-01.jpg');
  assert.equal(remote.requests[0].body.equals(jpeg), true);
  assert.equal(await publisher(t, {}).uploadAsset(jpeg, 'x.jpg', 'image/jpeg'), null);
});
