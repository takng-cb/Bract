/**
 * オブジェクト管理スモーク（バグ: オブジェクトが一つもない / REQ-0010）。
 * 組み込みオブジェクトが一覧表示されること。
 */
import { test, expect } from '@playwright/test'

test('オブジェクト管理: 組み込みオブジェクトが表示される', async ({ page }) => {
  await page.goto('/admin/books', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'オブジェクト管理' })).toBeVisible()
  await expect(page.getByText('オブジェクトがまだありません')).toHaveCount(0)
  // 代表的な組み込みオブジェクトのラベル
  await expect(page.getByText('取引先一覧', { exact: true })).toBeVisible()
  await expect(page.getByText('商談一覧', { exact: true })).toBeVisible()
  await page.screenshot({ path: 'test-results/admin-objects.png', fullPage: false })
})
