/**
 * ブック管理スモーク（バグ: ブックが一つもない / REQ-0010）。
 * 組み込みブックが一覧表示されること。
 */
import { test, expect } from '@playwright/test'

test('ブック管理: 組み込みブックが表示される', async ({ page }) => {
  await page.goto('/admin/books', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'ブック/モジュール管理' })).toBeVisible()
  await expect(page.getByText('カスタムブックはまだありません')).toHaveCount(0)
  // 代表的な組み込みブックのラベル
  await expect(page.getByText('取引先一覧', { exact: true })).toBeVisible()
  await expect(page.getByText('商談一覧', { exact: true })).toBeVisible()
  await page.screenshot({ path: 'test-results/admin-books.png', fullPage: false })
})
