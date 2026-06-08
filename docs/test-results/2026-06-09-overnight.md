# テスト結果ログ — 2026-06-09（夜間自律作業）

> 自動テストの結果を記録（Issue #50）。go/no-go 判断材料。

## 1. ユニットテスト（Vitest）
- コマンド: `npx vitest run`
- 結果: **143 passed / 14 files**（全 pass）
- 追加: `caliInsurance.test.ts`（自賠責計算 6件）、`staffingService.test.ts` を tone 値に更新。

## 2. 3業種ビルド（next build --webpack）
- `NEXT_PUBLIC_INDUSTRY = base / real-estate / auto-body`
- 結果: **3業種すべて exit 0**（このログ作成時点の最新ビルド）。

## 3. E2E（Playwright / Chrome）
- 状態: **未実行（要・実行環境）**。理由と必要条件は下記。
- Playwright は dev サーバー起動＋認証 storageState（TEST_USER_PASSWORD 等）＋Chromium が必要。
  無監督の本セッションでは安全に起動できないため未実行。
- 次アクション（帰宅後 or CI）：
  - `npx playwright install chromium`
  - `.env` に `TEST_USER_PASSWORD` 等を用意
  - `npm run test:e2e`（auth.setup → smoke-authenticated → CRUD）
  - 結果を本ディレクトリに追記。

## 4. スモーク（本番 32 ページ）
- `scripts/smoke-test.ts` はデプロイ URL に対する HTTP スモーク。dev/本番 URL 指定が必要。未実行。

---
更新者: Claude（夜間自律）。E2E/スモークは実行環境が整い次第ここに追記。
