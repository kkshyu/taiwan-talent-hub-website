'use strict';
/* 交易通知信：Resend HTTP API。未設 RESEND_API_KEY 時只記 log、不寄，流程不受影響。
 * ponytail: 單一 provider、純文字為主；要模板或多語再抽。 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const MAIL_FROM = process.env.MAIL_FROM || '言文字｜台灣人才聚落 <us@emoji.tw>';
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'us@emoji.tw';

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** 純文字轉最簡 HTML（段落＋換行），避免信件客戶端吃掉換行。 */
function textToHtml(text) {
  return '<div style="font-family:-apple-system,\'Noto Sans TC\',sans-serif;line-height:1.8;color:#1B1A17;max-width:560px">' +
    String(text).split(/\n{2,}/).map(p => '<p>' + escapeHtml(p).replace(/\n/g, '<br>') + '</p>').join('') +
    '</div>';
}

async function sendMail({ to, subject, text, replyTo }) {
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!recipients.length) return { skipped: 'no-recipient' };
  if (!RESEND_API_KEY) {
    console.log(`[mail] 未設定 RESEND_API_KEY，略過寄送：${subject} → ${recipients.join(', ')}`);
    return { skipped: 'no-api-key' };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: MAIL_FROM, to: recipients, subject, text, html: textToHtml(text), reply_to: replyTo || undefined }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

/** 寄信失敗只記 log，不讓主流程失敗。 */
function sendMailQuietly(msg) {
  return sendMail(msg).catch(e => console.error('[mail] 寄送失敗：', e.message));
}

module.exports = { sendMail, sendMailQuietly, NOTIFY_EMAIL, MAIL_FROM };
