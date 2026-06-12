/**
 * 認証状態での smoke test。auth.setup.ts でログイン後の storageState を使い、
 * 主要画面が正しく表示されることを確認する。
 *
 * scripts/smoke-test.ts は未認証でステータスコードのみ確認。本テストは
 * 認証後の SSR + hydration を含めた表示まで検証する。
 *
 * 当面は admin で全業種共通シナリオを実行。
 */
import { test, expect } from '@playwright/test'

test.describe('Authenticated smoke (admin)', () => {
  test('ダッシュボード: ホーム（直近のやること / 期間内の活動）が表示される', async ({ page }) => {
    await page.goto('/dashboard')
    // ヘッダ（KPI カードは廃止。/dashboard は「ホーム」レイアウトに刷新）
    await expect(page.locator('h1')).toContainText('ホーム')
    await expect(page.getByText('直近のやること')).toBeVisible()
    await expect(page.getByRole('heading', { name: '期間内の活動' })).toBeVisible()
  })

  test('取引先一覧: テーブルまたはカードが表示される', async ({ page }) => {
    await page.goto('/accounts')
    await expect(page.locator('h1')).toContainText('取引先')
    // 「全 N 件」表示
    await expect(page.getByText(/全 \d+ 件/)).toBeVisible()
  })

  test('人物一覧: タブ切替（法人担当 / 個人顧客）', async ({ page }) => {
    await page.goto('/contacts')
    await expect(page.locator('h1')).toContainText('人物')
    await expect(page.getByRole('link', { name: /法人担当/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /個人顧客/ })).toBeVisible()
  })

  test('商談一覧: 表示確認', async ({ page }) => {
    await page.goto('/opportunities')
    await expect(page.locator('h1')).toContainText('商談')
  })

  test('活動履歴一覧: 表示確認', async ({ page }) => {
    await page.goto('/activities')
    await expect(page.locator('h1')).toContainText('活動履歴')
  })

  test('ToDo 一覧: 表示確認', async ({ page }) => {
    await page.goto('/tasks')
    await expect(page.locator('h1')).toContainText('ToDo')
  })

  test('売上予測: Recharts グラフが描画される', async ({ page }) => {
    await page.goto('/forecast')
    await expect(page.locator('h1')).toContainText('売上予測')
    // Recharts は <svg class="recharts-surface"> を出力
    await expect(page.locator('svg.recharts-surface').first()).toBeVisible({ timeout: 10_000 })
  })

  test('admin/audit-log: 監査ログページ', async ({ page }) => {
    await page.goto('/admin/audit-log')
    await expect(page.locator('h1')).toContainText('監査ログ')
  })

  test('admin/books: ブック/モジュール管理', async ({ page }) => {
    await page.goto('/admin/books')
    await expect(page.locator('h1')).toContainText('ブック/モジュール管理')
  })
})
