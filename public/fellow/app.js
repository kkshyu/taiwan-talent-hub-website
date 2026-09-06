/* =========================================================================
   言文字｜台灣人才聚落・創始會員計畫 — frontend logic
   資料層改打後端 REST API（/api/*），後端以 Postgres 儲存。
   多頁面：每個主題為獨立 view，由 go() 切換。
   ========================================================================= */
'use strict';

/* ---------- 常數 ---------- */
const PRICE = 35000;          // 創始會費（固定）
const TERM_MONTHS = 18;       // 會籍期間（月）
const GIFT_POINTS = 20000;    // 會籍贈點（一年效期）
const SLOTS = 100;            // 創始名額
const TARGET = PRICE * SLOTS; // 預收會費總額 NT$3,500,000

/* ---------- 工具 ---------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const NT = n => 'NT$' + Number(n || 0).toLocaleString('en-US');
const num = n => Number(n || 0).toLocaleString('en-US');
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const todayISO = () => new Date().toISOString().slice(0, 10);
function fmtDate(d) {
  if (!d) return '—';
  const x = new Date(d); if (isNaN(x)) return d;
  return `${x.getFullYear()}/${String(x.getMonth()+1).padStart(2,'0')}/${String(x.getDate()).padStart(2,'0')}`;
}

/* =========================================================================
   i18n — 由路徑決定語系（/en/fellow、/ja/fellow，否則中文）。
   只涵蓋前端「實際會執行到」的動態字串；靜態內容由各語系 index.html 提供。
   ========================================================================= */
const LANG = (location.pathname.match(/^\/(en|ja)\/fellow\b/) || [, 'zh'])[1];
const I18N = {
  zh: {
    joined: n => `已加入 ${n} 名`,
    confirming: '創始名單陸續確認中',
    progressRevealed: joined => `${joined} ／ 限量 100 名　·　售罄不補，與一般年費同價、加量不加價`,
    progressQuiet: confirming => `${confirming}　·　售止 2026-12-31，售罄不補`,
    srvErr: s => `伺服器錯誤（${s}）`,
    buyLoading: '正在前往安全付款頁…',
    buyErr: '目前無法開啟付款頁。請重試；若仍無法使用，請來信 us@emoji.tw，我們會協助你完成加入。',
    soldOut: '創始名額已滿或正由其他人結帳中，請稍後再試。',
    saleEnded: '創始會員已截止販售。如需確認，請來信 us@emoji.tw。',
    retry: '重試',
    contact: '來信詢問',
    contactSubject: '創始會員付款協助',
    paid: '✓ 金流已確認付款。團隊會依付款 Email 人工核對會員資料與創始權益，完成後另行通知；若需協助，請來信 <a href="mailto:us@emoji.tw">us@emoji.tw</a>。',
    canceled: '結帳已取消，未產生付款。你可以再次前往付款，或來信 <a href="mailto:us@emoji.tw">us@emoji.tw</a> 詢問。',
    verifyPending: '目前還無法確認這筆付款。請勿重複付款；請重新整理本頁再查一次，若仍未確認，請來信 <a href="mailto:us@emoji.tw">us@emoji.tw</a>。',
    unpaid: '目前未確認付款完成，此付款連結可能無效或已失效。你可以重新前往付款，或來信 <a href="mailto:us@emoji.tw">us@emoji.tw</a> 詢問。',
    verifying: '正在確認付款結果，請稍候…',
    close: '關閉通知',
  },
  en: {
    joined: n => `${n} joined`,
    confirming: 'Founding members are being confirmed',
    progressRevealed: joined => `${joined} ／ limited to 100 · no restock · same price as annual, more included`,
    progressQuiet: confirming => `${confirming} · on sale until 2026-12-31 · no restock`,
    srvErr: s => `Server error (${s})`,
    buyLoading: 'Opening secure checkout…',
    buyErr: 'Checkout is unavailable right now. Try again, or email us@emoji.tw and we will help you join.',
    soldOut: 'Founding spots are full or currently held by other checkouts. Please try again shortly.',
    saleEnded: 'Founding Member sales have ended. Email us@emoji.tw if you need help confirming this.',
    retry: 'Try again',
    contact: 'Email us',
    contactSubject: 'Founding Member checkout help',
    paid: '✓ Payment has been confirmed. The team will manually match the payment email with your member record and Founding benefits, then notify you when confirmed. For help, email <a href="mailto:us@emoji.tw">us@emoji.tw</a>.',
    canceled: 'Checkout was canceled and no payment was made. You can proceed to payment again, or email <a href="mailto:us@emoji.tw">us@emoji.tw</a>.',
    verifyPending: 'We cannot confirm this payment yet. Please do not pay again. Refresh this page to check again; if it remains unconfirmed, email <a href="mailto:us@emoji.tw">us@emoji.tw</a>.',
    unpaid: 'Payment was not confirmed. This payment link may be invalid or expired. You can proceed to payment again, or email <a href="mailto:us@emoji.tw">us@emoji.tw</a>.',
    verifying: 'Checking your payment status…',
    close: 'Dismiss notice',
  },
  ja: {
    joined: n => `${n} 名が参加`,
    confirming: '創始メンバーを順次確認中',
    progressRevealed: joined => `${joined} ／ 限定100名　·　完売後の追加なし、一般年会費と同価格で内容を増量`,
    progressQuiet: confirming => `${confirming}　·　2026-12-31 まで販売、完売後の追加なし`,
    srvErr: s => `サーバーエラー（${s}）`,
    buyLoading: '安全な決済ページを開いています…',
    buyErr: '現在、決済ページを開けません。再度お試しいただくか、us@emoji.tw までご連絡ください。',
    soldOut: '創始会員枠は満席、またはほかの決済で一時確保されています。しばらくしてから再度お試しください。',
    saleEnded: '創始会員の販売は終了しました。確認が必要な場合は us@emoji.tw までご連絡ください。',
    retry: '再試行',
    contact: 'メールで相談',
    contactSubject: '創始会員の決済について',
    paid: '✓ 決済が確認されました。チームが決済メールアドレスと会員情報・創始会員特典を手動で照合し、確認後にお知らせします。サポートが必要な場合は <a href="mailto:us@emoji.tw">us@emoji.tw</a> までご連絡ください。',
    canceled: '決済はキャンセルされ、お支払いは発生していません。もう一度決済へ進むか、<a href="mailto:us@emoji.tw">us@emoji.tw</a> までご連絡ください。',
    verifyPending: 'このお支払いはまだ確認できません。重複して支払わず、このページを再読み込みして再確認してください。確認できない場合は <a href="mailto:us@emoji.tw">us@emoji.tw</a> までご連絡ください。',
    unpaid: 'お支払いは確認できませんでした。この決済リンクは無効または期限切れの可能性があります。もう一度決済へ進むか、<a href="mailto:us@emoji.tw">us@emoji.tw</a> までご連絡ください。',
    verifying: 'お支払い状況を確認しています…',
    close: '通知を閉じる',
  },
};
const T = I18N[LANG] || I18N.zh;

/* =========================================================================
   API 資料層
   ========================================================================= */
const TOKEN_KEY = 'tth_token';
let DB = { bond: { target_amount: TARGET, raised: 0, progress: 0, status: '' },
           users: [], commitments: [], payments: [], updates: [] };
let SESSION = null; // {role, userId}

const getToken = () => localStorage.getItem(TOKEN_KEY) || '';
const setToken = t => { try { localStorage.setItem(TOKEN_KEY, t); } catch (e) {} };
const clearToken = () => { try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem('tth_name'); } catch (e) {} };

async function api(path, { method = 'GET', body, signal } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    const error = new Error(data.error || T.srvErr(res.status));
    error.status = res.status; error.code = data.code;
    throw error;
  }
  return data;
}

async function timedApi(path, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await api(path, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

async function fetchState() {
  const s = await api('/state');
  DB = { bond: s.bond, users: s.users || [], commitments: s.commitments || [], payments: s.payments || [], updates: s.updates || [] };
  SESSION = { role: s.role, userId: s.me ? s.me.id : null };
  if (s.me && s.me.name) try { localStorage.setItem('tth_name', s.me.name); } catch (e) {}
}
async function refresh() { await fetchState(); renderProgress(); applyRole(); }

// 公開訪客用：只讀進度與專案更新，無需登入、無 PII
async function fetchPublic() {
  try {
    const s = await api('/public');
    DB = { ...DB, bond: { ...DB.bond, raised: Number(s.raised) || 0 }, updates: s.updates || [] };
    renderProgress();
  } catch (e) { /* 後端未就緒時維持靜態預設值 */ }
}

/* 衍生計算（讀本機快取） */
const userById = id => DB.users.find(u => u.id === id);
const commitmentsOf = uid => DB.commitments.filter(c => c.user_id === uid);
const paymentsOf = cid => DB.payments.filter(p => p.commitment_id === cid);
const confirmedRaised = () => Number(DB.bond.raised || 0);
// 已加入名額：以已確認會費金額換算人數（會費固定 NT$35,000）
const memberCount = () => Math.min(SLOTS, Math.floor(confirmedRaised() / PRICE));

/* =========================================================================
   渲染：靜態區塊
   ========================================================================= */
const REVEAL_AT = 10;   // 低於此人數不顯示空進度條（0% 是負面社會證明），改質性文案
function renderProgress() {
  const count = memberCount();
  const pct = Math.min(100, Math.round(count / SLOTS * 100));
  const revealed = count >= REVEAL_AT;
  const fund = $('#hero-fund-pct') && $('#hero-fund-pct').closest('.fund');
  if (fund) fund.classList.toggle('fund--quiet', !revealed);   // CSS 隱藏數字/進度條，露出質性文案
  if ($('#hero-fund-pct')) $('#hero-fund-pct').textContent = pct + '%';
  if ($('#hero-fund-raised')) $('#hero-fund-raised').textContent = revealed
    ? T.progressRevealed(T.joined(count))
    : T.progressQuiet(T.confirming);
  const bar = $('#hero-fund-bar');
  if (!bar) return;
  const fill = () => { bar.style.width = pct + '%'; };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { fill(); io.disconnect(); } }), { threshold: .4 });
    io.observe(bar.closest('.terms-card'));
  } else fill();
}

/* =========================================================================
   路由（多頁面）
   ========================================================================= */
const VIEWS = ['home','why-now','about','project','membership','risk'];
let activeView = null;
const viewUrl = hash => location.pathname + location.search + hash;
function go(view, opts = {}) {
  if (!VIEWS.includes(view)) view = 'home';
  if (view === activeView && !opts.replace) return;
  const targetHash = view === 'home' ? '' : '#' + view;
  if (opts.replace) {
    history.replaceState({ view, scrollY: Number(opts.scrollY) || 0 }, '', viewUrl(targetHash));
  } else if (!opts.fromHistory && activeView) {
    history.replaceState({ view: activeView, scrollY: window.scrollY }, '');
    history.pushState({ view, scrollY: 0 }, '', viewUrl(targetHash));
  } else if (opts.fromHistory) {
    history.replaceState({ view, scrollY: Number(opts.scrollY) || 0 }, '', viewUrl(targetHash));
  }
  $$('.view').forEach(v => v.classList.remove('active'));
  const target = $('#view-' + view);
  target.classList.add('active');
  activeView = view;
  setNavActive(view);
  window.scrollTo({ top: Number(opts.scrollY) || 0, behavior: 'auto' });
  if (opts.focus !== false) {
    const heading = target.querySelector('h1, h2');
    if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
  }
  closeMenu();
  observeReveal();
}
function restoreView(state) {
  const view = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
  if (view === activeView) return;
  go(view, { fromHistory: true, scrollY: state && state.view === view ? state.scrollY : 0 });
}
let scrollFrame = 0;
function rememberScroll() {
  if (!activeView || scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    history.replaceState({ view: activeView, scrollY: window.scrollY }, '');
  });
}
function setNavActive(view) {
  $$('.nav-links a[data-go]').forEach(a => a.classList.toggle('active', a.dataset.go === view));
}

/* =========================================================================
   成為創始會員
   ========================================================================= */
const CONTRACT_HTML = `
<h4>言文字創始會員入會協議（摘要）</h4>
<p>本協議由入會人（乙方）與發起方 徐愷 KK（甲方）就乙方加入「言文字｜台灣人才聚落」創始會員計畫事宜訂立。乙方自願加入，本計畫<strong>不限邀請</strong>，性質為<strong>會籍預售</strong>。</p>
<h4>第一條　會籍內容與期間</h4>
<p>乙方取得創始會員會籍，期間 18 個月，內容包含：二、三樓會員限定空間進出（人臉辨識門禁）、三樓共享辦公與活動空間自由使用、社群活動與互助網絡資格，以及創始專屬權益（三樓創始牆名錄、創始晚餐邀請、續約鎖價保障）。</p>
<h4>第二條　贈點與兌換規則</h4>
<p>乙方於付款成功時獲贈點數 20,000 點（每點 1 元，預設一年效期），得兌換二樓淋浴、膠囊休憩席與交誼廳等指定服務（淋浴 70 點／次；膠囊休憩席與交誼廳各 100 點／小時，須持有效會籍）。贈點不得轉讓、不得折換現金；購買點另依點數規則辦理。</p>
<h4>第三條　會費與付款</h4>
<p>創始會費為新台幣 35,000 元整（固定，與一般年費同牌價），以線上刷卡或匯款一次付清；甲方對帳確認入帳後，核發創始會員證並保留創始編號（001–100）。</p>
<h4>第四條　會籍起算日</h4>
<p>會籍自 2026 年 11 月 1 日起算；若據點啟用延後，自實際啟用日起算，會籍期間與贈點均不縮減。</p>
<h4>第五條　條件式服務揭露</h4>
<p>二樓 24 小時膠囊休憩席、交誼廳與淋浴服務屬條件式服務，於律師口頭意見後由營運方確認啟用；啟用前，乙方之贈點得依會員規章兌換已開放之服務項目，細節依會員規章辦理。</p>
<h4>第六條　退費</h4>
<p>創始會籍不可退費；若乙方日後無法繼續使用，得通知甲方更新登記後轉讓會籍。轉讓細節依會員規章辦理；乙方於簽署正本前將取得完整文本。</p>
<h4>第七條　性質聲明</h4>
<p>本協議為會籍預售之服務契約；乙方支付會費所取得者為會籍與贈點。創始會員證僅為管理與紀錄憑證，不得轉讓或交易。</p>
<h4>第八條　個人資料</h4>
<p>甲方依《個人資料保護法》第 8 條，為履約、會籍管理與法令遵循之目的蒐集、處理及利用乙方個人資料；乙方得依法行使查詢、更正、刪除等權利（詳見完整協議）。</p>
<h4>第九條　準據法與管轄</h4>
<p>本協議以中華民國法律為準據法，並以台灣台北地方法院為第一審管轄法院。</p>
<p style="margin-top:1em;color:var(--faint)">※ 本摘要供線上確認之用；完整協議可於登入後之 Dashboard 下載 PDF。正式生效以雙方簽署（用印）之正本為準，正式條款以律師核定版為準。</p>`;

function setupJoin() {
  $('#contract-box').innerHTML = CONTRACT_HTML;
  $('#join-form').addEventListener('submit', submitJoin);
}

// 登入者開啟「成為創始會員」時自動帶入既有資料（只填空白欄位）
function prefillJoin() {
  if (!SESSION || !SESSION.userId) return;
  const u = userById(SESSION.userId); if (!u) return;
  const fill = (id, v) => { const el = $(id); if (el && !el.value && v) el.value = v; };
  fill('#f-name', u.name); fill('#f-email', u.email); fill('#f-phone', u.phone);
}

async function submitJoin(e) {
  e.preventDefault();
  const msg = $('#join-msg'); msg.className = 'form-msg';
  if (!getToken()) { // 送出前需先以邀請碼或 Email 登入
    msg.textContent = '請先以邀請碼或 Email 登入後送出。'; msg.classList.add('err');
    $('#cover').classList.remove('hidden'); $('#login-input').focus();
    return;
  }
  if (!$('#agree-contract').checked) { msg.textContent = '請先閱讀並同意入會協議與會員規章。'; msg.classList.add('err'); return; }
  if (!$('#agree-privacy').checked) { msg.textContent = '請勾選同意個人資料之蒐集、處理與利用。'; msg.classList.add('err'); return; }
  if (!$('#join-form').reportValidity()) return;

  const btn = $('#join-form button[type=submit]'); btn.disabled = true;
  try {
    const { commitment } = await api('/commitments', { method: 'POST', body: {
      amount: PRICE, term: TERM_MONTHS,
      name: $('#f-name').value.trim(), email: $('#f-email').value.trim(), phone: $('#f-phone').value.trim(),
      agree_member: $('#agree-member').checked,
    }});
    await refresh();
    go('dashboard');
    toast('已收到你的入會申請，協議已用印');
    showRemittance(commitment);
  } catch (err) {
    msg.textContent = err.message; msg.classList.add('err');
  } finally { btn.disabled = false; }
}

function showRemittance(c) {
  if (!c) return;
  const box = document.createElement('div');
  box.className = 'fieldset'; box.style.marginTop = '24px';
  box.innerHTML = `
    <h3><span class="idx">$</span> 匯款資訊</h3>
    <p class="tiny" style="margin-top:-8px">發起人將以 Email／LINE 通知匯款帳戶資訊；請於收到後 3 個工作天內完成匯款，並保留收據。發起方確認入帳後，將為你保留創始編號並核發創始會員證。</p>
    <div class="table-wrap" style="margin-top:8px"><table class="led"><tbody>
      <tr><td>會費</td><td class="num">${NT(c.amount)}</td></tr>
      <tr><td>匯款備註</td><td class="num">${esc(c.cert_no)}</td></tr>
    </tbody></table></div>`;
  const host = $('#dash-content'); host.insertBefore(box, host.firstChild);
}

/* =========================================================================
   Dashboard
   ========================================================================= */
function renderDashboard() {
  const host = $('#dash-content');
  if (!SESSION || !SESSION.userId) { host.innerHTML = emptyState('請先以會員身分登入。'); return; }
  const u = userById(SESSION.userId);
  const cs = commitmentsOf(u.id);
  $('#dash-hello').textContent = `${u.name}，你好`;
  if (!cs.length) {
    host.innerHTML = `<div class="panel"><div class="panel-b" style="padding:40px;text-align:center">
      <p>你目前還沒有入會紀錄。</p>
      <button class="btn btn-seal" data-go="join">查看入會方式</button></div></div>`;
    bindGo(host); return;
  }

  const c = cs[0];
  const totalFee = cs.reduce((s, x) => s + x.amount, 0);
  const allPays = cs.flatMap(x => paymentsOf(x.id));
  const confirmed = cs.some(x => x.payment_status === '已付款');
  const memActive = cs.some(x => x.membership_status === '已啟用');

  const stat = (l, v, u2, m, accent = '') =>
    `<div class="stat ${accent}"><div class="sl">${l}</div><div class="sv">${u2 ? `<span class="u">${u2}</span>` : ''}${v}</div>${m ? `<div class="sm">${m}</div>` : ''}</div>`;

  host.innerHTML = `
    <div class="dash-grid">
      ${stat('創始會費', num(totalFee), 'NT$', '一次付清・與一般年費同價', 'accent')}
      ${stat('會籍期間', TERM_MONTHS + '<span class="u"> 個月</span>', '', '自據點啟用日起算')}
      ${stat('會籍起訖', `${fmtDate(c.start_date)}<span class="u"> 起</span>`, '', `至 ${fmtDate(c.maturity_date)}・啟用延後則順延`)}
      ${stat('贈點', GIFT_POINTS.toLocaleString('en-US') + '<span class="u"> 點</span>', '', '付款入帳・一年效期・不可轉讓兌現')}
      ${stat('創始編號', esc(c.cert_no), '', '限量 100 名')}
      ${stat('會員狀態', memActive ? '已啟用' : (confirmed ? '待啟用' : '待入帳'), '', '創始會員 Founding Member')}
      ${stat('創始權益', '3<span class="u"> 項</span>', '', '創始牆・創始晚餐・續約鎖價')}
      ${stat('專案建置進度', DB.bond.progress + '<span class="u">%</span>', '', '見專案更新')}
    </div>

    <div class="dash-cols">
      <div class="panel">
        <div class="panel-h"><h3>會費收款紀錄</h3><span class="status-pill ${confirmed ? 'pill-ok' : 'pill-wait'}">${confirmed ? '已入帳' : '待確認入帳'}</span></div>
        <div class="panel-b flush"><div class="table-wrap" style="border:0">
          <table class="led"><thead><tr><th>項目</th><th>應收日</th><th class="num">金額</th><th>狀態</th></tr></thead>
          <tbody>${allPays.sort((a, b) => a.due_date < b.due_date ? -1 : 1).map(p => `
            <tr><td>${p.type}</td><td class="num">${p.due_date}</td><td class="num">${NT(p.amount)}</td>
            <td><span class="status-pill ${p.status === '已付' ? 'pill-paid' : 'pill-due'}">${p.status === '已付' ? '已付' + (p.paid_date ? ` · ${p.paid_date}` : '') : '未付'}</span></td></tr>`).join('')}
          </tbody></table>
        </div></div>
      </div>

      <div>
        <div class="member-card">
          <div class="mc-k">Founding Member</div>
          <div class="mc-t">創始會員・18 個月會籍＋贈點 20,000</div>
          <div class="mc-st"><span class="status-pill ${memActive ? 'pill-ok' : 'pill-wait'}">${memActive ? '已啟用' : '待啟用'}</span></div>
          <ul>
            <li>二、三樓會員限定空間進出（人臉辨識門禁）</li>
            <li>三樓共享辦公與活動空間自由使用</li>
            <li>社群活動與互助網絡資格</li>
            <li>二樓 24 小時休憩屬條件式服務，於律師口頭意見後由營運方確認啟用，並以點數折抵</li>
            <li>創始牆名錄・創始晚餐・續約鎖價保障</li>
          </ul>
        </div>
        <div class="dash-actions">
          ${cs.map(x => `
            <button class="btn btn-ink btn-sm" data-cert="${x.id}">${cs.length > 1 ? esc(x.cert_no) + ' 會員證' : '創始會員證'}</button>
            <button class="btn btn-ghost btn-sm" data-agr="${x.id}">${cs.length > 1 ? esc(x.cert_no) + ' 協議' : '下載入會協議 PDF'}</button>`).join('')}
          <button class="btn btn-ghost btn-sm" data-go="updates">專案更新</button>
        </div>
        <div class="panel" style="margin-top:16px">
          <div class="panel-h"><h3>我的協議</h3></div>
          <div class="panel-b"><div class="table-wrap" style="border:0"><table class="led"><tbody>
            ${cs.map(x => `<tr><td>${esc(x.cert_no)}</td><td class="num">${NT(x.amount)}</td><td>${x.contract_status}</td></tr>`).join('')}
          </tbody></table></div></div>
        </div>
      </div>
    </div>`;

  $$('[data-cert]', host).forEach(b => b.addEventListener('click', () => go('certificate', { certId: b.dataset.cert })));
  $$('[data-agr]', host).forEach(b => b.addEventListener('click', () => go('agreement', { certId: b.dataset.agr })));
  bindGo(host);
}

/* =========================================================================
   創始會員證
   ========================================================================= */
function renderCertificate(certId) {
  const host = $('#cert-content');
  let c;
  if (certId) c = DB.commitments.find(x => x.id === certId);
  else if (SESSION && SESSION.userId) c = commitmentsOf(SESSION.userId)[0];
  if (!c) { host.innerHTML = emptyState('尚無可顯示的會員證。'); return; }
  const u = userById(c.user_id) || { name: '—' };
  host.innerHTML = `
  <div class="cert">
    <div class="cert-in">
      <div class="cert-top">言文字 Founding Member Certificate</div>
      <h2>Founding Member</h2>
      <div class="cert-cn">言文字｜台灣人才聚落・創始會員證</div>
      <div class="cert-doc">本會員證證明下列持有人依入會協議為言文字｜台灣人才聚落創始會員</div>
      <hr>
      <div class="cert-rows">
        <div class="cr wide"><div class="crl">持有人　Holder</div><div class="crv">${esc(u.name)}</div></div>
        <div class="cr"><div class="crl">會費　Fee</div><div class="crv">${NT(c.amount)}</div></div>
        <div class="cr"><div class="crl">贈點　Points</div><div class="crv">20,000 點</div></div>
        <div class="cr"><div class="crl">會籍起日　From</div><div class="crv">${fmtDate(c.start_date)}</div></div>
        <div class="cr"><div class="crl">會籍迄日　To</div><div class="crv">${fmtDate(c.maturity_date)}</div></div>
        <div class="cr"><div class="crl">期間　Term</div><div class="crv">${c.term_years || TERM_MONTHS} 個月</div></div>
        <div class="cr"><div class="crl">身分　Status</div><div class="crv">創始會員 Founding Member</div></div>
        <div class="cr wide"><div class="crl">創始編號　Certificate No.</div><div class="crv">${esc(c.cert_no)}</div></div>
      </div>
      <div class="cert-foot">
        <div class="cert-sign">
          <div class="sn">徐愷 KK</div>
          <div class="sl">發起人　Founder, Taiwan Talent Hub</div>
        </div>
        <div class="cert-seal"><div><span>台灣人才</span><b>聚落</b><span>FOUNDING</span></div></div>
      </div>
    </div>
  </div>`;
}

/* =========================================================================
   入會協議（可列印 / 另存 PDF）
   ========================================================================= */
function renderAgreement(certId) {
  const host = $('#agreement-content');
  let c;
  if (certId) c = DB.commitments.find(x => x.id === certId);
  else if (SESSION && SESSION.userId) c = commitmentsOf(SESSION.userId)[0];
  if (!c) { host.innerHTML = emptyState('尚無可顯示的協議。'); return; }
  const u = userById(c.user_id) || {};
  host.innerHTML = `
  <div class="agreement">
    <h2>言文字創始會員入會協議</h2>
    <div class="ag-en">Founding Membership Agreement・會籍預售契約</div>
    <div class="ag-meta"><span>編號 ${esc(c.cert_no)}</span><span>簽署日 ${fmtDate(c.start_date)}</span><span>準據法 中華民國</span></div>
    <div class="ag-parties">
      <div class="ag-party"><b>甲方（發起方）</b>徐愷 KK<br>地址：台北市中正區重慶南路一段 11 號</div>
      <div class="ag-party"><b>乙方（入會人）</b>${esc(u.name || '—')}<br>電話：${esc(u.phone || '—')}<br>Email：${esc(u.email || '—')}</div>
    </div>
    <p>雙方本於誠信，就乙方加入甲方推動之「言文字｜台灣人才聚落」創始會員計畫事宜，訂立本協議。乙方自願加入，本計畫不限邀請，性質為會籍預售。</p>
    <h4>第一條（會籍內容與期間）</h4>
    <p>乙方取得創始會員會籍，期間 18 個月。會籍權益包含：二、三樓會員限定空間進出（人臉辨識門禁）、三樓共享辦公與活動空間自由使用、社群活動與互助網絡資格，以及創始專屬權益：三樓創始牆名錄、創始晚餐邀請、續約鎖價保障（未來牌價調漲不影響乙方首次續約價格）。</p>
    <h4>第二條（贈點與兌換規則）</h4>
    <p>乙方於付款成功時獲贈點數 20,000 點（每點 1 元，預設一年效期），持有效會籍者得兌換二樓指定服務；贈點不得轉讓、不得折換現金。</p>
    <h4>第三條（會費與付款）</h4>
    <p>創始會費為新台幣 ${num(c.amount)} 元整（固定，與一般年費同牌價），乙方以線上刷卡或匯款一次付清。甲方對帳確認入帳後，核發創始會員證並保留乙方之創始編號（001–100）。</p>
    <h4>第四條（會籍起算日）</h4>
    <p>會籍自 2026 年 11 月 1 日起算；若據點啟用延後，自實際啟用日起算，會籍期間與贈點均不縮減。系統顯示之起訖日（${fmtDate(c.start_date)} 至 ${fmtDate(c.maturity_date)}）將依實際啟用日調整。</p>
    <h4>第五條（條件式服務揭露）</h4>
    <p>二樓 24 小時膠囊休憩席、交誼廳與淋浴服務屬條件式服務，於律師口頭意見後由營運方確認啟用；啟用前，乙方之贈點得依會員規章兌換已開放之服務項目，細節依會員規章辦理。乙方確認已知悉並同意上述安排。</p>
    <h4>第六條（退費）</h4>
    <p>創始會籍不可退費；若乙方日後無法繼續使用，得通知甲方更新登記後轉讓會籍。轉讓細節依會員規章辦理；乙方於簽署正本前將取得完整文本，正式權利義務以律師核定版為準。</p>
    <h4>第七條（性質聲明）</h4>
    <p>本協議為會籍預售之服務契約；乙方支付會費所取得者為會籍與贈點。甲方核發之創始會員證僅為管理與紀錄憑證，不得轉讓、質押或交易，亦不得對外公開招攬或勸誘。</p>
    <h4>第八條（個人資料之蒐集、處理及利用）</h4>
    <p>甲方依《個人資料保護法》第 8 條告知：蒐集乙方姓名、身分證統一編號、聯絡方式、地址及帳務資料，目的為本協議之履行、會籍管理與法令遵循；利用期間至法令規定之保存期限屆滿，利用地區為中華民國。乙方得依法請求查詢、閱覽、複製、補正、停止利用或刪除其個人資料。</p>
    <h4>第九條（契約審閱）</h4>
    <p>乙方確認已於合理期間內審閱本協議全部條款並充分了解其內容。</p>
    <h4>第十條（準據法與管轄）</h4>
    <p>本協議以中華民國法律為準據法；因本協議所生爭議，雙方同意以台灣台北地方法院為第一審管轄法院。本協議未盡事宜，依會員規章及相關法令辦理。</p>
    <div class="ag-sign">
      <div class="col"><div class="sn">徐愷 KK</div><div class="ln">甲方　發起人簽章／用印</div></div>
      <div class="ag-seal"><div><span>台灣人才</span><b>聚落</b><span>FOUNDING</span></div></div>
      <div class="col"><div class="sn" style="color:var(--muted)">${esc(u.name || '')}</div><div class="ln">乙方　入會人簽章／用印</div></div>
    </div>
    <p class="ag-note" style="margin-top:24px">簽署日期：${fmtDate(c.start_date)}　·　本文件由系統依雙方約定產生，供留存與用印之用；正式生效以雙方簽署之正本為準，正式條款以律師核定版為準。</p>
  </div>`;
}

/* =========================================================================
   專案更新
   ========================================================================= */
function tagClass(t) { return t === '月報' ? 'tag-month' : t === '季報' ? 'tag-quarter' : 'tag-major'; }
function renderUpdates() {
  const list = $('#updates-list');
  const ups = [...DB.updates].sort((a, b) => a.published_at < b.published_at ? 1 : -1);
  list.innerHTML = ups.length ? ups.map(u => `
    <article class="update">
      <div class="um"><span class="tag ${tagClass(u.type)}">${esc(u.type)}</span><span class="ud">${esc(u.published_at)}</span></div>
      <h3>${esc(u.title)}</h3>
      <p class="ubody">${esc(u.content)}</p>
    </article>`).join('') : emptyState('尚無專案更新。');
}

/* =========================================================================
   共用 UI
   ========================================================================= */
function emptyState(t) { return `<div class="panel"><div class="panel-b" style="padding:40px;text-align:center;color:var(--muted)">${esc(t)}</div></div>`; }
function bindGo(root) { $$('[data-go]', root).forEach(b => b.addEventListener('click', e => { e.preventDefault(); go(b.dataset.go); })); }
function bindCopy(root) {
  $$('.copy-btn', root).forEach(b => b.addEventListener('click', () => {
    const t = b.dataset.copy;
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('已複製邀請連結')).catch(() => prompt('複製此連結：', t));
  }));
}
let toastT;
function toast(msg) { const t = $('#toast'); $('#toast-msg').textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }

function applyRole() {
  const role = SESSION ? SESSION.role : null;
  const show = (sel, on) => $$(sel).forEach(el => el.style.display = on ? '' : 'none');
  show('.role-participant', role === 'participant');
  show('.role-admin', role === 'admin');
  // 公開訪客（role === null）也看得到「成為創始會員」CTA
  show('.role-invited', role === 'invited' || role === 'participant' || role === null);
  // 登入／登出切換
  const authed = !!SESSION;
  const lo = $('#logout-btn'); if (lo) lo.style.display = authed ? '' : 'none';
  const li = $('#login-open'); if (li) li.style.display = authed ? 'none' : '';
}

let revealIO;
function observeReveal() {
  if (!('IntersectionObserver' in window)) return;
  if (!revealIO) revealIO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); revealIO.unobserve(e.target); } }), { threshold: 0, rootMargin: '0px 0px 22% 0px' });
  $$('.view.active .section-head, .view.active .prose, .view.active .reveal').forEach(el => { if (!el.classList.contains('in')) revealIO.observe(el); });
}
function closeMenu() { const m = document.getElementById('navLinks'); if (m) m.classList.remove('open'); }

/* =========================================================================
   啟動
   ========================================================================= */
function enterApp() {
  document.body.classList.add('authed');
  $('#cover').classList.add('hidden');
  applyRole();
  go(SESSION && SESSION.role === 'admin' ? 'admin' : 'home');
}

/* =========================================================================
   購買（Stripe Checkout 導轉）
   ========================================================================= */
async function startCheckout(btn) {
  if (!btn || startCheckout.busy) return;
  startCheckout.busy = true;
  const buttons = $$('[data-buy]');
  buttons.forEach(b => { b.dataset.buyLabel ||= b.textContent; b.disabled = true; b.setAttribute('aria-busy', 'true'); });
  if (btn) btn.textContent = T.buyLoading;
  $('.checkout-feedback')?.remove();
  $('.checkout-loading')?.remove();
  const loading = document.createElement('div');
  loading.className = 'checkout-loading'; loading.setAttribute('role', 'status'); loading.setAttribute('aria-live', 'polite');
  loading.textContent = T.buyLoading;
  const host = btn.closest('.fnd-invite__cta, .pagenav') || btn;
  host.insertAdjacentElement('afterend', loading);
  try {
    const { url } = await timedApi('/checkout', { method: 'POST', body: { lang: LANG } });
    if (!url) throw new Error(T.buyErr);
    location.href = url;               // 導向 Stripe 代管結帳頁
  } catch (e) {
    startCheckout.busy = false;
    loading.remove();
    buttons.forEach(b => { b.disabled = false; b.removeAttribute('aria-busy'); b.textContent = b.dataset.buyLabel; });
    const box = document.createElement('div');
    box.className = 'checkout-feedback'; box.setAttribute('role', 'alert'); box.setAttribute('tabindex', '-1');
    const message = e.code === 'SOLD_OUT' ? T.soldOut : e.code === 'SALE_ENDED' ? T.saleEnded : T.buyErr;
    const retry = e.code !== 'SALE_ENDED' && e.status !== 410;
    box.innerHTML = `<p>${esc(message)}</p><div>${retry ? `<button class="btn btn-ghost btn-sm" type="button">${esc(T.retry)}</button>` : ''}<a href="mailto:us@emoji.tw?subject=${encodeURIComponent(T.contactSubject)}">${esc(T.contact)}</a></div>`;
    if (retry) box.querySelector('button').addEventListener('click', () => startCheckout(btn));
    host.insertAdjacentElement('afterend', box);
    box.focus();
  }
}

// 從 Stripe 返回：顯示付款結果橫幅（自包含樣式，CIS 唯一黃／墨）
async function showPurchaseResult() {
  const p = new URLSearchParams(location.search);
  const requestedPaid = p.get('paid') === '1'; const canceled = p.get('canceled') === '1';
  if (!requestedPaid && !canceled) return;
  const bar = document.createElement('div');
  bar.setAttribute('role', 'status'); bar.setAttribute('aria-live', 'polite'); bar.setAttribute('aria-atomic', 'true');
  const render = result => {
    bar.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:300;padding:14px 60px 14px 20px;'
      + 'font-size:1rem;line-height:1.6;text-align:center;box-shadow:0 6px 20px -10px rgba(0,0,0,.5);'
      + (result === 'paid' ? 'background:#FFDE34;color:#1B1A17;' : 'background:#1B1A17;color:#EDE9E0;');
    const message = result === 'paid' ? T.paid : result === 'canceled' ? T.canceled
      : result === 'unpaid' ? T.unpaid : result === 'verifying' ? T.verifying : T.verifyPending;
    bar.innerHTML = message
      + `<button aria-label="${esc(T.close)}" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);width:44px;height:44px;`
      + 'background:none;border:0;font-size:1.4rem;line-height:1;cursor:pointer;color:inherit">×</button>';
    bar.querySelector('button').addEventListener('click', () => bar.remove());
  };
  let result = canceled ? 'canceled' : 'pending';
  if (requestedPaid) {
    render('verifying');
    document.body.appendChild(bar);
    try {
      result = (await timedApi('/checkout/verify?s=' + encodeURIComponent(p.get('s') || ''))).paid ? 'paid' : 'unpaid';
    } catch (e) {
      if (e.status && e.status < 500) result = 'unpaid';
    }
  }
  // 已確認、未付款或已取消才清掉 query；供應商暫時不可用時保留 session id 供重新整理查驗。
  if (result !== 'pending') history.replaceState(history.state, '', location.pathname + location.hash);
  render(result);
  if (!bar.isConnected) document.body.appendChild(bar);
}

async function init() {
  document.body.classList.add('js');
  showPurchaseResult();
  document.addEventListener('click', e => {
    const buy = e.target.closest('[data-buy]');
    if (buy) { e.preventDefault(); startCheckout(buy); }
  });
  // 手機漢堡選單由共用 nav.js 處理（共用導覽列）
  bindGo(document);
  // 深連結：/fellow#why-now 進站即開對應 view；並監聽 hash 變化（導覽下拉點選）
  const hv = location.hash.slice(1);
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  go(VIEWS.includes(hv) ? hv : 'home', { replace: true, focus: false });
  addEventListener('popstate', e => restoreView(e.state));
  addEventListener('hashchange', () => restoreView(history.state));
  addEventListener('scroll', rememberScroll, { passive: true });
  fetchPublic();   // 進度在背景更新，不讓 API 延遲阻塞導覽與進場顯示。
}

document.addEventListener('DOMContentLoaded', init);
