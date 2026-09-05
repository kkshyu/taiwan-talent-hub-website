// 本地產文批次排入：Claude Code 在本機寫好貼文 JSON，經 admin API 上傳素材＋建立 scheduled 貼文。
// 用法：ADMIN_API_KEY=... node scripts/ig-local-fill.mjs <posts.json> [--dry]
//   金鑰也可放 ../.tmp/admin_key（repo 外、不進 git）。
//   posts.json：{ assets: { key: { file, note } }, posts: [ { date:'YYYY-MM-DD', time:'19:00', title, caption, caption_ja, caption_en, hashtags, pages:[{category,variant,format,...,photo:'@asset:key'}] } ] }
// 排程日已有 IG 貼文或為週四（主軸日）→ 順延一天。
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.SITE_BASE || 'https://www.emoji.tw';
const keyFile = path.resolve(import.meta.dirname, '../../.tmp/admin_key');
const KEY = (process.env.ADMIN_API_KEY || (existsSync(keyFile) ? readFileSync(keyFile, 'utf8') : '')).trim();
if (!KEY) { console.error('缺 ADMIN_API_KEY（env 或 ../.tmp/admin_key）'); process.exit(1); }
const [file, ...flags] = process.argv.slice(2);
const DRY = flags.includes('--dry');
const spec = JSON.parse(readFileSync(file, 'utf8'));
const H = { authorization: `Bearer ${KEY}` };

async function api(p, init = {}) {
  const r = await fetch(BASE + p, { ...init, headers: { ...H, ...(init.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${p} ${r.status} ${j.error || JSON.stringify(j)}`);
  return j;
}

const { posts: existing } = await api('/api/admin/social/posts');
const taken = new Set(existing.filter(p => p.platform === 'ig' && ['scheduled', 'publishing', 'published'].includes(p.status) && p.scheduled_at)
  .map(p => new Date(new Date(p.scheduled_at).getTime() + 8 * 3600e3).toISOString().slice(0, 10)));
console.log(`既有 IG 排程日 ${taken.size} 天`);
const titles = new Set(existing.map(p => p.title));   // 重跑不重複建立

const assetUrl = {};
for (const [k, a] of Object.entries(spec.assets || {})) {
  const fp = path.resolve(path.dirname(file), a.file);
  if (DRY) { assetUrl[k] = `dry://${k}`; console.log(`[dry] 素材 ${k} ← ${fp}`); continue; }
  const fd = new FormData();
  fd.append('file', new Blob([readFileSync(fp)], { type: 'image/jpeg' }), path.basename(fp));
  fd.append('note', a.note);
  const r = await api('/api/admin/ig/assets/upload', { method: 'POST', body: fd });
  assetUrl[k] = r.url; console.log(`素材 ${k} → ${r.url}`);
}

const shift = d => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString().slice(0, 10); };
for (const p of spec.posts) {
  if (titles.has(p.title)) { console.log(`略過（已存在）${p.title}`); continue; }
  let d = p.date;
  while (taken.has(d) || new Date(d + 'T00:00:00Z').getUTCDay() === 4) d = shift(d);
  taken.add(d);
  const pages = (p.pages || []).map(pg => {
    const o = { format: 'portrait', ...pg };
    if (typeof o.photo === 'string' && o.photo.startsWith('@asset:')) o.photo = assetUrl[o.photo.slice(7)];
    return o;
  });
  const body = { platform: 'ig', post_type: pages.length > 1 ? 'carousel' : 'image', status: 'scheduled',
    title: p.title, caption: p.caption, caption_ja: p.caption_ja, caption_en: p.caption_en, hashtags: p.hashtags,
    pages, scheduled_at: `${d} ${p.time || '19:00'}`, series: p.series || '本地補產', phase: p.phase || '',
    notes: `[local-fill] Claude Code 本地產生 ${new Date().toISOString().slice(0, 10)}${d !== p.date ? `；原定 ${p.date} 順延` : ''}` };
  if (DRY) { console.log(`[dry] ${d} ${p.time || '19:00'} ${p.title}${d !== p.date ? `（原 ${p.date}）` : ''}`); continue; }
  const r = await api('/api/admin/social/posts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  console.log(`排入 ${d} ${p.time || '19:00'} ${p.title} → ${r.id}`);
}
