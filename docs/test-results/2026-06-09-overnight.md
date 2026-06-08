# テスト結果ログ — 2026-06-09（夜間自律作業）

> 自動テストの結果を記録（Issue #50）。go/no-go 判断材料。

## 1. ユニットテスト（Vitest）
- コマンド: `npx vitest run`
- 結果: **143 passed / 14 files**（全 pass）
- 追加: `caliInsurance.test.ts`（自賠責計算 6件）、`staffingService.test.ts` を tone 値に更新。

## 2. 3業種ビルド（next build --webpack）
- `NEXT_PUBLIC_INDUSTRY = base / real-estate / auto-body`
- 結果: **3業種すべて exit 0**。

## 3. E2E（Playwright / Chrome）— ✅ 実行・全 pass
- コマンド: `NEXT_PUBLIC_INDUSTRY=base BRACT_DISABLE_INDUSTRY_REDIRECTS=1 TEST_USER_PASSWORD=… npx playwright test industry-routes --project=chromium-admin`
- セットアップ: `scripts/seed-test-users.ts`（admin/editor/viewer を dev に投入）、`npx playwright install chromium`。
- **結果: 17 passed（36.5s）**
  - auth setup 3件（admin/editor/viewer のログイン → storageState 保存）
  - 主要ルート スモーク 14件：dashboard / accounts / contacts / opportunities / activities / tasks / expenses /
    **vehicles / parts / maintenance / customer-vehicles / properties / assignments / staff** がいずれも 404 にならず開ける。
- **意義**: `NEXT_PUBLIC_INDUSTRY=base`（＝auto-body 以外のビルド）で /vehicles・/parts 等が開けることを確認。
  ユーザー報告の 404（業種ページが activeIndustry でゲートされていた）の修正を**ブラウザで実証**。

### 実行中に発見・修正したバグ
- **`tests/e2e/auth.setup.ts` のログインボタン誤クリック**：`button:has-text("ログイン")` が
  「Google でログイン」ボタン（"ログイン" を含む）にマッチし、Google OAuth 画面へ遷移して
  auth state 生成が失敗 → 全 E2E が動かない状態だった。`getByRole('button', { name: 'メールでログイン' })` に修正。

## 4. スモーク（本番 32 ページ）
- `scripts/smoke-test.ts` はデプロイ URL に対する HTTP スモーク。dev/本番 URL 指定が必要。未実行（任意）。

---
更新者: Claude（夜間自律）。次回 E2E は CRUD/業種シナリオ spec の拡充を検討。
