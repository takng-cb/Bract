import { test, expect } from '@playwright/test'
test('モジュール管理: トグルスイッチと固定表示', async ({ page }) => {
  await page.goto('/admin/modules', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'モジュール構成' })).toBeVisible()
  // 切替可能なモジュールにスイッチが出る
  await expect(page.getByRole('switch').first()).toBeVisible()
  // 基盤(ALWAYS_ON)は「常時有効」固定
  await expect(page.getByText('常時有効').first()).toBeVisible()
  await page.screenshot({ path: 'test-results/module-toggle.png', fullPage: false })
})
