# 確認事項まとめ — 2026-06-09 夜間自律作業（出張帰宅後に確認）

> Claude が夜間に自律実施した内容と、**あなたの操作が必要な点**、判断した事項を集約。
> 「少々の手戻り許容」前提で積極的に進めています。気になる箇所は指示ください。

---

## ⚠️ あなたの操作が必要な点（最優先で確認）

### 1. Google ログイン（#44）— 設定値の訂正
- **重要な訂正**：Site URL に `https://eknwcgfcvpgehlfipdib.supabase.co`（＝Supabase の URL）を入れるのは**誤り**です。
  これが原因で「requested path is invalid」になります。Site URL は**アプリ（Vercel）の URL**を入れます。
- 正しい設定（Supabase Dashboard → Authentication → **URL Configuration**）：
  - **Site URL** = アプリのデプロイ URL（ブラウザでアプリを開いた時のアドレス。例 `https://bract-xxxx.vercel.app`。`supabase.co` ではない）
  - **Redirect URLs**（許可リスト）に以下を追加：
    - `https://bract-xxxx.vercel.app/**`（あなたのアプリ URL ＋ `/**`）
    - `http://localhost:3000/**`（ローカル用）
- コード/`supabase/config.toml` 側は対応済み（`https://*.vercel.app/**` 等を allow-list 化）。dashboard 値が反映されれば解決します。
- 補足：Google ログインの redirect 先は `アプリURL/auth/callback`。これが Redirect URLs に含まれていれば OK。

### 2. dev で不動産/板金/人材を Vercel で確認する場合（REQ-0021）
- ローカル `npm run dev` なら **そのまま全業種表示・データ確認可**（`.env.local` 設定済み）。
- dev の **Vercel** で見るなら、環境変数 `BRACT_DISABLE_INDUSTRY_REDIRECTS=1` を追加して再デプロイ。

### 3. Chrome E2E（Playwright）テスト（#50）
- 設定済みだが **未実行**。理由：テストユーザーの認証情報（`TEST_USER_PASSWORD` 等）が env に無い／Chromium 未インストール。
- 実行するには：`npm run test:e2e:install` → 認証情報を env に → `npm run test:e2e`。結果は `docs/test-results/` に追記。

---

## ✅ 夜間に実施・本番反映済み

### バグ修正
- **#44 Google ログイン localhost**：config.toml の許可リスト修正（cloud 反映は上記操作）。
- **#46 整備画面から ToDo/活動/経費が作れない**：原因は作成後 `/objects/maintenance/<id>`（404）へ redirect していたこと。`recordHref()` で業種専用ルート（`/maintenance/<id>` 等）へ解決するよう修正（tasks/activities/expenses 共通）。

### 新機能
- **#47 自賠責保険料の自動計算**：公定料率表（2023-04・本土）に基づく `calcCaliPremium()` を実装（ユニットテスト付き）。整備詳細に「自賠責を自動計算して追加」ボタン → 非課税の諸費用として追加。
  - 沖縄・離島は別料率（未対応・明記）。料率改定時はテーブル更新。

### Issue 管理
- 起票：#44（Google）/#45（整備インライン作成）/#46（ToDo バグ）/#47（自賠責）/#48（ERP inventory）/#49（AI 低手数）/#50（テスト基盤）/#51（デザイン残）。

### テスト
- Vitest **143 件 pass**、3業種ビルド **exit 0**。詳細 `docs/test-results/2026-06-09-overnight.md`。

---

## 🔜 着手中／次にやること（夜間で進められた分まで）
- **#45 整備入力で取引先・顧客車両の一括作成/検索**：未着手（大きめ。次の優先）。
- **#48 ERP inventory モジュール PoC**：未着手。
- **#49 AI 起点の低手数オペレーション**：未着手（板金の受付メモ→車両/整備/部品/ToDo 一括下書き等を検討）。
- デザイン残（#51）：見出し/空状態の絵文字、画面個別の作り込み。

---

## 🧭 私が判断した事項（手戻り許容範囲）
- 業種ページのゲートを `activeIndustry`→`isModuleEnabled` に移行（本番互換を保証）。
- 業種リダイレクト無効化は **dev フラグ**方式（本番挙動は不変）。
- 自賠責は**ライブサイト連携でなく公定料率テーブル**で実装（安定・改定時更新）。
- デザインは段階移行（zinc/blue を新トークンにリマップ）で全画面一括反映。

> 「整備画面で…」のメッセージが途中で切れていた件、ToDo 作成不可（#46）と自賠責（#47）として解釈・対応しました。他に意図があれば教えてください。
