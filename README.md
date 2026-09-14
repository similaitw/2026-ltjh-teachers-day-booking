# 羅東國中教師節・暖心按摩預約

9/16（三）羅東國中教師會 × 社團法人宜蘭縣盲人福利協進會教師節按摩宣導服務預約網站。

- 活動時間：13:00–16:00
- 地點：大表藝教室
- 每時段：15 分鐘
- 每時段上限：8 人
- 共 12 個時段、96 名
- 一個 Email 同時只能有 1 筆有效預約
- 可自行更改時段、取消預約
- 管理者密碼登入，可看各時段統計、完整總表與匯出 CSV
- 管理者可修改時段或取消預約；取消前需確認，取消後釋出名額並保留取消紀錄。
- 管理端標示各時段剩餘名額，額滿時段不可選；後端於交易取得活動鎖後重新檢查名額，避免同時預約或改期造成超額。
- 資料庫：Vercel Marketplace 的 Neon Postgres

## 架構

- 前端：HTML / CSS / Vanilla JS
- API：Vercel Functions (`/api/*.js`)
- Database：Neon Postgres（從 Vercel Storage / Marketplace 建立）
- Source：GitHub
- Hosting：Vercel

## Vercel 環境變數

```env
DATABASE_URL=postgresql://...
ADMIN_PASSWORD=你的管理密碼
ADMIN_SESSION_SECRET=一串夠長的隨機字串
```

Neon 整合通常會自動建立 `DATABASE_URL`。`ADMIN_PASSWORD` 與 `ADMIN_SESSION_SECRET` 請在 Vercel Project → Settings → Environment Variables 設定。

## 資料表

API 第一次使用時會自動建立 `bookings` 表與必要索引；也可手動執行 `sql/schema.sql`。

## 本機開發

```bash
npm install
npm i -g vercel
vercel env pull .env.local
vercel dev
```

## 正式部署

1. 將此專案推到 GitHub。
2. 在 Vercel 匯入 GitHub repository。
3. Vercel 專案內新增 Storage / Database → Neon Postgres。
4. 設定 `ADMIN_PASSWORD`、`ADMIN_SESSION_SECRET`。
5. 重新部署。
6. 開 `/api/health`，若顯示 `database: connected` 即完成。

## 管理端

`/admin.html`

管理端使用 HttpOnly Cookie，登入後 12 小時有效。完整總表不會由公開 API 回傳。

## 整合測試

使用 Node.js 24 與獨立、可拋棄的 PostgreSQL 測試資料庫。設定 `TEST_DATABASE_URL` 後執行 `npm run test:integration`；不可使用正式資料庫。

測試涵蓋管理者權限、額滿拒絕、原時段更新、取消與重複取消、取消後釋出名額，以及預約／自行改期／管理者改期同時競爭最後一個名額。測試透過本機 Postgres 執行實際 SQL，Neon HTTP 傳輸層使用測試替身。
