/**
 * モジュール ON/OFF（#11 → #21 で /admin/books に統合）。
 * 旧 /admin/modules は互換リダイレクトのみ。admin でアクセスすると
 * /admin/books に転送され、モジュールごとのトグルスイッチと
 * ALWAYS_ON の「常時有効」固定バッジが表示される。
 */
import { test, expect } from '@playwright/test'

test('モジュール管理: /admin/modules は /admin/books へ統合（トグルと固定表示）', async ({ page }) => {
  await page.goto('/admin/modules', { waitUntil: 'domcontentloaded' })
  // 旧 URL からのリダイレクト
  await expect(page).toHaveURL(/\/admin\/books/)
  await expect(page.getByRole('heading', { name: 'ブック/モジュール管理' })).toBeVisible()
  // 切替可能なモジュールにスイッチが出る
  await expect(page.getByRole('switch').first()).toBeVisible()
  // 基盤(ALWAYS_ON)は「常時有効」固定
  await expect(page.getByText('常時有効').first()).toBeVisible()
  await page.screenshot({ path: 'test-results/module-toggle.png', fullPage: false })
})
