'use strict';

const FLOORS = [1, 2, 3, 4];
const LANGS = ['zh', 'en', 'ja'];

function spaceBodyKey(floor, lang) {
  return `space_${floor}f_${lang}`;
}

function spaceImageKey(floorOrHero) {
  if (floorOrHero === 'hero') return 'space_hero_image';
  return `space_${floorOrHero}f_image`;
}

function resolveFloorMarkdown(content, floor, lang) {
  const c = content || {};
  const primary = String(c[spaceBodyKey(floor, lang)] || '').trim();
  if (primary) return primary;
  if (lang === 'zh') return String(c[`space_${floor}f`] || '').trim();
  return '';
}

function resolveSpaceImage(content, floorOrHero) {
  const c = content || {};
  return String(c[spaceImageKey(floorOrHero)] || '').trim();
}

/** 顧客向短文；對齊 CIS 語氣；二樓禁用住宿用語。實作時可微調文句，但測試禁止禁用詞。 */
const SPACE_SEED = {
  space_1f_zh: `2026 年 11 月 1 日正式開幕後，早上可約客戶喝咖啡、中午吃日式簡餐；入夜後同一樓層切換為三點水（3AM）深夜食堂與餐酒館。一般來訪不需先加入會員。

- 約 25.2 坪；內用約 20–30 席、長吧檯、外帶視窗
- 白天在咖啡，入夜三點水
- 所有訪客皆可使用，不需會員`,
  space_1f_en: `After the official opening on November 1, 2026, meet a client over coffee in the morning or have a Japanese set meal at lunch. After dark, the same floor becomes 三點水 (3AM), a late-night eatery and bistro. General visitors do not need a membership.

- About 25.2 ping; 20–30 seats, long counter, takeout window
- 在咖啡 (at cafe) by day; 三點水 (3AM) after dark
- Open to everyone; no membership required`,
  space_1f_ja: `2026年11月1日の正式開幕後は、朝に取引先とコーヒー、昼に日本式の定食を楽しめます。夜は同じフロアが三點水（3AM）の深夜食堂・ビストロに変わります。一般利用に会員登録は不要です。

- 約25.2坪、20〜30席、ロングカウンター
- 昼は在咖啡、夜は三點水
- どなたでも利用可。会員登録不要`,
  space_2f_zh: `工作告一段落，需要休息、淋浴或轉換心情時，會員可到二樓看書、使用休憩席，或到娛樂室玩 Switch、看漫畫、玩桌遊與麻將。24 小時使用為條件式啟用，採人臉辨識進出。

- 約 29.5 坪；休憩與娛樂分區、隔音加強
- 席位掃 QR 自助登記計時；非密閉、不可上鎖
- 僅供會員休憩與活動`,
  space_2f_en: `When work is done and you need to rest, shower, or reset, members can read, use a rest seat, or unwind with Switch, manga, board games, and mahjong. Access is controlled by face entry; 24-hour use is conditional.

- About 29.5 ping; rest and play zones with stronger sound isolation
- QR check-in per seat; open pods, not lockable
- Member rest and recreation only`,
  space_2f_ja: `仕事が一段落し、休憩やシャワー、気分転換が必要なときに使う会員専用フロアです。読書・休憩席のほか、Switch・マンガ・ボードゲーム・麻雀を楽しめます。顔認証で入退室し、24時間利用は条件付きです。

- 約29.5坪。休憩と娯楽を分け、遮音を強化
- 席ごとにQRでチェックインし、時間を記録。密閉不可・施錠不可
- 会員の休憩と交流のための空間`,
  space_3f_zh: `白天可帶筆電工作或開小組會議。社群主辦人可申請講座、工作坊與交流活動；企業、團隊或客戶包場請另以 Email 洽詢。三樓位於老屋斜屋頂與挑高六米的木樑下。

- 約 29.9 坪；大投影、自助點心吧、充足插座與高速網路
- 可切分為小組討論區；包場另議`,
  space_3f_en: `Use 3F for focused work or a small meeting by day. Community organizers may apply to host talks, workshops and meetups. Companies, teams and client-event organizers should email us about private hire. The space sits under the old timber roof and six-meter ceiling.

- About 29.9 ping; large projection, self-serve snack counter, power and fast wifi
- Subdividable discussion zones; private hire available`,
  space_3f_ja: `昼はノートPCを持ち込んで仕事や少人数のミーティングに利用できます。コミュニティ主催者は、講座・ワークショップ・交流会の会場利用を申請できます。企業・チーム・顧客向けイベントの貸切は、メールでお問い合わせください。古い斜屋根と天井高6メートルの木梁が残る空間です。

- 約29.9坪。大型投影、セルフの軽食コーナー、電源と高速回線
- 小さなグループ席に区切り可。貸切も相談可`,
  space_4f_zh: `會員需要洗衣時，可使用頂樓的附屬設施；戶外另設吸菸區。非會員如有使用需求，須依臨時通行安排。

- 約 7.5 坪
- 洗衣機設於附屬設施（頂樓），減少穿越三樓社群區
- 非會員至附屬設施採臨時通行控管`,
  space_4f_en: `Members who need laundry facilities can use the rooftop area, which also includes an outdoor smoking zone. Non-members require temporary access arrangements.

- About 7.5 ping
- Laundry upstairs to avoid cutting through the 3F community floor
- Non-members use temporary pass codes when needed`,
  space_4f_ja: `会員が洗濯設備を必要とするときに使える屋上の附属施設です。屋外喫煙エリアもあります。非会員は一時通行の手続きが必要です。

- 約7.5坪
- 洗濯機は附属施設（屋上）へ。3Fコミュニティを横切らない配置
- 非会員は一時通行で管理`,
};

function missingSpaceSeedKeys(existingContent) {
  const c = existingContent || {};
  const miss = [];
  for (const f of FLOORS) {
    for (const lang of LANGS) {
      const k = spaceBodyKey(f, lang);
      if (!String(c[k] || '').trim()) miss.push(k);
    }
  }
  return miss;
}

module.exports = {
  FLOORS,
  LANGS,
  spaceBodyKey,
  spaceImageKey,
  resolveFloorMarkdown,
  resolveSpaceImage,
  SPACE_SEED,
  missingSpaceSeedKeys,
};
