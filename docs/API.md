# API 目錄

言文字｜台灣人才聚落 — 後台與前台 REST API 全清單。供 AI agent 管理資料使用。

> **本檔由 `scripts/test-api-docs.mjs` 強制與 `server.js` 同步。**
> 新增或刪除 `/api/*` 端點卻沒更新本檔，`npm test` 會失敗。請勿手動放寬該測試。

Base URL：`https://www.emoji.tw`（本地：`http://localhost:8080`）
所有請求與回應皆為 JSON（檔案上傳除外，用 `multipart/form-data`）。

## 認證

三種身分，都走 `Authorization: Bearer <token>`：

| 身分 | 憑證 | 用途 |
|---|---|---|
| AI agent | `ADMIN_API_KEY` 環境變數的值 | 管理全部後台資料（等同超級管理員） |
| 會員／管理員 | Google 登入後簽發的 token | 網站前台與後台 UI |
| 門禁裝置 | `ACCESS_DOOR_SECRET` 的值 | 只能打 `/api/access/scan` |

AI agent 用法：

```bash
curl -H "Authorization: Bearer $ADMIN_API_KEY" https://www.emoji.tw/api/state
```

金鑰產生：`openssl rand -hex 32`，設在 Zeabur 環境變數 `ADMIN_API_KEY`。
少於 24 字元會被忽略（視同未設定）。要撤銷就換一組新的並重啟。

**注意事項**

- 金鑰＝超級管理員，可指派管理員、發點數、改所有內容。只存在環境變數，絕不可寫進前端或 commit。
- agent 身分沒有綁定會員（`sub` 為 null），因此所有 `/api/me/*` 與報名類端點會回 403。這是刻意的。
- agent 發放點數時，`point_ledger.actor` 記為 `agent`。
- 會員 token 有效七天；每次請求以資料庫目前的管理員權限為準。部署本次修正後，舊版無期限 token 須重新登入。
- OAuth state 有效十分鐘，使用 HttpOnly、SameSite=Lax cookie 綁定發起登入的瀏覽器，不能作為 API token。

## 慣例

- **Upsert**：`events`、`updates`、`social/posts` 的 POST 帶 `id` 就是更新，不帶就是新增。沒有 PATCH 動詞。
- **時間**：社群貼文的排程時間以台北時間（UTC+8）讀寫，格式 `YYYY-MM-DDTHH:mm`。
- **錯誤**：非 2xx 一律回 `{ "error": "中文訊息" }`。DB 未就緒回 503。

## 公開端點（免認證）

### GET /api/health
服務健康檢查。回 `{ ok, db, dbConfigured }`。

### GET /api/public
公開唯讀資料，無個資：`{ raised, updates, events, content }`。活動只含「報名中」且公開的項目。
`content` 僅回首頁公告、菜單及空間文案／圖片白名單；IG token 與內部排程資料不會傳至瀏覽器。

### GET /api/events
公開活動列表。只回 `visibility=public` 且「報名中」的活動與已成立報名數。

### GET /api/events/:slug
活動詳情。公開活動與私人活動皆可由直接連結讀取；私人活動不會出現在列表。帶有效會員 Bearer token 時一併回自己的報名、付款與簽到狀態。

### GET /api/points/packs
點數方案定價表。回 `{ price_twd, packs }`。

### POST /api/checkout
所有結帳、活動付款、點數購買、退款與 webhook 都必須使用 Stripe「Emoji 言文字」帳號 `acct_1Ts2y95NXMKDsl40`。

建立 Stripe 結帳（購買創始會籍）。body：`{ lang }`。回 `{ url }`。未設 `STRIPE_SECRET_KEY` 或 DB 未就緒時回 503；超過 `SALE_END`（預設 2026-12-31）回 410。已付款與有效結帳保留名額合計達 `MAX_PARTICIPANTS`（預設 100）回 409。新 checkout 保留 30 分鐘；以 Postgres 交易鎖序列化所有 instance 的名額盤點與建立。

### GET /api/checkout/verify
付款成功頁驗證。query：`s`（Stripe checkout session id）。向 Stripe 確認 `payment_status=paid` 且為創始會員商品，回 `{ paid }`。

### POST /api/access/verify
驗證進出 QR token 是否有效。body：`{ token }`。回 `{ ok, claims }`。

### POST /api/stripe/webhook
Stripe 活動與點數付款 webhook。只接受 `STRIPE_WEBHOOK_SECRET` 驗證成功的原始 request body；處理 `checkout.session.completed`、`checkout.session.async_payment_succeeded` 與 `checkout.session.expired`。點數與活動皆驗證訂單、帳號、session、TWD 幣別及金額快照；重送不會重複核銷或入點。

## 登入

### GET /auth/google
導向 Google OAuth。query：`redirect`（須為白名單來源）。

### GET /auth/google/callback
Google 授權回呼，簽發會員 token 並導回。

## 主要讀取端點

### GET /api/state
**agent 讀取後台資料的主要入口。** 需認證。管理員身分回傳全部：

```
{ role: 'admin', super, me, bond: { target_amount, raised },
  users[], commitments[], entitlements[], events[], content{}, updates[] }
```

`users[]` 每筆含 `access_active`、`access_summary`、`points_balance`。
會員身分則只回自己的資料（`me`、`commitments`、`access`、`points`、`point_orders`、報名中活動）。
綁定會員的管理員另有本人 `access`、`points`、`point_orders`；會員及管理員皆有本人尚在處理的 `point_refunds`，供退款重試使用。

## 後台管理（需管理員或 agent 金鑰）

### GET /api/admin/event-applications
讀取社群場地申請及聯絡資料，回 `{ applications }`。僅管理員可讀，不會加入公開活動清單。

### POST /api/admin/event-applications/:id/review
審核待審申請。body：`{ status: "approved" | "rejected", review_note, expected_status: "pending" }`，回 `{ ok, application }`。回覆必填、最多 2000 字，申請人可見。不存在回 404；已審核或其他管理員先完成時回 409，不覆蓋既有結果。保存審核者與時間。審核通過不會自動保留場地、收費或建立／發布活動；檔期、費用與合作條件仍須書面確認。

### POST /api/admin/updates
新增或更新最新消息。body：`{ id?, title, content, type, date }`。
`type` 限：`月報`｜`季報`｜`重大事項`｜`活動通知`｜`財務摘要`（不合法則存為 `重大事項`）。
帶 `id` 為更新，找不到回 404。回 `{ ok, id }`。

### DELETE /api/admin/updates/:id
刪除最新消息。

### POST /api/admin/events
新增或更新活動。body：`{ id?, slug?, title, description, location, starts_at, ends_at, capacity, price_twd, visibility, status }`。
`visibility` 限 `public`｜`private`；`status` 限 `草稿`｜`報名中`｜`已結束`；票價與名額為 0 以上整數。帶 `id` 為更新，回 `{ ok, id, slug }`。

### DELETE /api/admin/events/:id
刪除沒有任何報名紀錄的活動。已有報名時回 409，應改為「已結束」以保留付款與簽到稽核。

### GET /api/admin/events/:id/regs
該場活動的報名名單，含聯絡、票券狀態、應付／已付、付款與簽到時間。回 `{ regs }`。

### POST /api/admin/events/:id/check-in
掃描或人工簽到。body 擇一：`{ token }`（活動票 QR 內容）或 `{ registration_id }`。只接受已成立且未退款的票券；重掃回 `duplicate: true`。

### DELETE /api/admin/events/:id/check-in/:registrationId
取消一筆活動簽到，保留報名與付款紀錄。

### POST /api/admin/events/:id/regs/:registrationId/refund
對已成立的付費票執行 Stripe 全額退款並立即使票券失效。以 registration id 作 Stripe idempotency key，重送不會重複退款。

### POST /api/admin/content
寫入網站內容（key-value，含菜單 `menu` 與空間文案）。body：`{ key, value }`。
永遠是 upsert。讀取請走 `/api/state` 或 `/api/public` 的 `content`。

### GET /api/admin/social/posts
全部 IG／X 貼文規劃。回 `{ posts }`。

### POST /api/admin/social/posts
新增或更新社群貼文。帶 `id` 為更新。body 主要欄位：

- `platform`：`ig`｜`x`
- `post_type`：IG 限 `carousel`｜`image`；X 限 `text`｜`image`
- `status`：`draft`｜`ready`｜`scheduled`｜`published`｜`archived`
- `title`（必填）、`caption`、`caption_en`、`caption_ja`、`hashtags`
- `pages[]`（X 平台會強制清空）、`images[]`、`metrics{}`
- `scheduled_at`、`published_at`：台北時間 `YYYY-MM-DDTHH:mm`
- `external_url`（限 http/https）、`series`、`phase`、`cta`、`audience`、`notes`

### DELETE /api/admin/social/posts/:id
刪除貼文。刪除種子貼文（`sp_seed_*`）會寫入墓碑，避免下次部署復活。

### POST /api/admin/social/:id/publish-ig
立即發布單篇 IG 貼文（不等排程）。成功回 `{ ok, url, images }`；失敗把錯誤寫回貼文 `notes` 並回 502。

### GET /api/admin/ig/status
IG 自動發文系統狀態：token 有無、AI key 有無、未來排程、錯誤與逾期清單、素材庫統計。

### POST /api/admin/ig/compose
手動觸發 AI 補產（正常由每週日 cron 執行）。回 `{ ok, made }`；需 `ANTHROPIC_API_KEY`。

### GET /api/admin/ig/assets
素材庫清單（最新 100 筆）。回 `{ assets }`。

### POST /api/admin/ig/assets
登記素材：body `{ url, note }`。`url` 限 `/uploads/social/` 路徑或 https；`note` 必填（AI 產文要呼應照片內容）。

### POST /api/admin/x/compose
X 貼文 AI 起草：body `{ topic }`，回 `{ ok, draft: { title, caption, caption_ja } }`。
沿用 IG 補產的品牌鐵律與禁用字守門；需 `ANTHROPIC_API_KEY`，未設回 502。

### GET /api/admin/ads/campaigns
廣告投放紀錄列表。回 `{ campaigns }`（日期為 `YYYY-MM-DD` 字串）。

### POST /api/admin/ads/campaigns
新增或更新投放紀錄。帶 `id` 為更新。body 欄位：

- `layer`：`awareness`｜`retarget`｜`action`（三層廣告結構）
- `status`：`planned`｜`running`｜`done`
- `start_date`、`end_date`：`YYYY-MM-DD`；結束日不可早於開始日
- `budget`、`spent`：NT 整數（負值歸零）
- `post_id`：關聯的 social_posts id（選填，須存在）
- `metrics{}`（如 `reach`、`clicks`）、`notes`

### DELETE /api/admin/ads/campaigns/:id
刪除投放紀錄。

### POST /api/admin/upload/social
上傳貼文圖片。`multipart/form-data`，欄位名 `file`，限 5MB 影像。回 `{ url }`。

### POST /api/admin/upload/space
上傳空間介紹圖片。同上限制。回 `{ url }`。

### POST /api/admin/ig/assets/upload
素材檔案直傳：multipart `file`＋`note`（素材說明必填）→ MinIO `assets/`（未設 S3 則落 `/uploads/social/`）→ 登記 `ig_assets`。回 `{ ok, id, url }`。

### POST /api/admin/upload/menu
上傳菜單品項圖片（multipart `file`，≤5MB，jpeg/png/webp）。有設 S3 時存 MinIO `assets/menu-*`，否則落 `/uploads/menu/`。回 `{ url }`。

### POST /api/admin/commitments/:id/confirm
確認參與款項入帳：`payment_status` → 已付款、`membership_status` → 已啟用、
使用者 `status` → 已參與，並建立創始會員權益與贈點。

### POST /api/admin/entitlements
建立會員權益。body：`{ user_id, plan, ... }`。

### POST /api/admin/points/grants
發放點數。body：`{ user_id, amount, note（必填）, expires_at? }`。預設一年後到期。

### GET /api/admin/users/:id/points
指定會員的點數餘額與批次明細。

### POST /api/admin/points/orders/:id/fulfill
手動完成點數訂單（Stripe webhook 失敗時的補救）。

### POST /api/admin/users/:id/admin
指派或取消管理員。body：`{ admin: boolean }`。**限超級管理員或 agent 金鑰。**

## 會員端點（agent 一律 403）

以下需綁定會員身分，agent 金鑰打會得到 403。

### GET /api/me/access-qr
取得 45 秒有效的進出 QR token。

### GET /api/me/points
自己的點數餘額與批次。

### POST /api/me/points/redeem
以點數兌換服務（休憩、淋浴）。

### POST /api/me/points/orders
建立點數加值訂單（走 Stripe）。

### POST /api/me/points/orders/:id/fulfill
完成自己的點數訂單。session 必須與原訂單、會員、方案、TWD 幣別及應付金額全部吻合，不能套用其他已付款 checkout。

### POST /api/me/points/refunds
點數退款。body：`{ point_order_id, principal_points }`。先持久化扣點與 pending 退款紀錄，再對 Stripe 退款；中斷時回 502 及 `refund_id`。同訂單有 pending 紀錄時，再次送出只重試原紀錄與金額。Stripe 明確失敗或取消時交易回補原點數與贈點，回 409 及 `refund_id`；僅 succeeded 標示完成。

### POST /api/commitments
送出參與（創始會籍）申請。Email 必須為目前已驗證的 Google 登入信箱，此表單不會更動登入身分。

### POST /api/event-applications
登入帳號提出三樓活動空間申請，不需付費會籍；agent 金鑰沒有申請人身分，回 403。

body：`{ request_id, community_name, contact_name, contact_email, contact_phone?, title, description, starts_at, ends_at, attendees, requirements?, consent: true }`。

- `request_id`：前端產生的 UUID；相同帳號與識別碼重試只會保存一次。同內容回原申請（200），不同內容回 409；新申請回 201。回應為 `{ ok, application }`。
- 名稱長度上限：社群 120、聯絡人 80、Email 254、電話 40、活動名稱 160；活動內容 5000、需求 2000 字。電話與需求可留空，其餘必填；Email 必須有效。
- `starts_at`／`ends_at`：台灣時間 `YYYY-MM-DDTHH:mm`，必須是真實日期、開始晚於現在、結束晚於開始。回應日期為 ISO 8601。
- `attendees`：1–10000 整數，僅是預估人數，不代表場地容納量或核准人數。
- 需明確同意須知，保存同意時間；伺服器固定初始狀態為 `pending`，忽略自訂審核與申請人欄位。
- 每帳號每小時最多新增 10 筆，超過回 429；同筆重試不佔額度。資料庫未就緒回 503，不回報成功。

### GET /api/me/event-applications
讀取登入帳號自己的申請，回 `{ applications }`，包含申請內容、`id`、`status`（`pending`／`approved`／`rejected`）、`review_note`、`created_at` 與 `reviewed_at`。不接受指定其他使用者，agent 金鑰回 403；不在公開 API 提供申請或聯絡資料。

### POST /api/events/:id/register
報名活動。body：`{ note?, lang? }`。免費票立即成立；付費票建立或沿用未過期的 Stripe Checkout，回 `{ url }`。付費活動未設定 `STRIPE_WEBHOOK_SECRET` 時 fail closed 回 503。

### DELETE /api/events/:id/register
取消免費且尚未簽到的報名。付費票須由後台退款，不可直接取消。

### POST /api/events/checkout/verify
會員付款回站補查。body：`{ session_id }`；驗證 Stripe Session 屬於目前帳號後呼叫同一個冪等核銷流程。webhook 仍是可靠核銷主路徑。

### GET /api/events/:id/ticket
取得自己的活動票券簽章 token。只對已成立且未退款的報名簽發；簽到時仍會查資料庫狀態。

## 門禁端點

### POST /api/access/scan
掃描進出 QR，開門並惰性啟用權益。需 `ACCESS_DOOR_SECRET`。
以 `(entitlement_id, token_iat)` 冪等，重掃回 `duplicate: true`。

## 目前沒有 API 的操作

刻意不提供，不是遺漏：

- **改 `users.status` / `can_view`**：`status` 由 `/api/admin/commitments/:id/confirm` 流程驅動，手改會與 commitment 狀態不一致；`can_view` 目前沒有任何邏輯讀取。
- **改／刪 entitlements**：後台 UI 也沒有，需要時再開。
- **刪 users、刪 commitments**：涉及金流與權益，一律走人工。
