/**
 * ダッシュボード（ホーム）スモーク。
 * 現行 UI: KPI カードは廃止され、/dashboard は「ホーム」として
 * 直近のやること / 期間内の活動 / 最近更新されたレコード を表示する
 * （KPI 系ウィジェットはモジュールホーム側に scope 化 #105）。
 */
import { test, expect } from '@playwright/test'

test('ダッシュボード: ホーム（直近のやること・期間内の活動・最近のレコード）', async ({ page }) => {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('h1')).toContainText('ホーム')
  await expect(page.getByText('直近のやること')).toBeVisible()
  await expect(page.getByRole('heading', { name: '期間内の活動' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '最近更新されたレコード' })).toBeVisible()
  await page.screenshot({ path: 'test-results/dashboard.png', fullPage: false })
})
