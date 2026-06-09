import { test, expect } from '@playwright/test'
test('設定: ダッシュボードウィジェットの並び替えボタン', async ({ page }) => {
  await page.goto('/settings', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('ダッシュボード表示設定')).toBeVisible()
  await expect(page.getByRole('button', { name: /を上へ/ }).first()).toBeVisible()
  await page.screenshot({ path: 'test-results/dashboard-reorder.png', fullPage: false })
})
