/**
 * ブック管理スモーク（バグ: ブックが一つもない / REQ-0010）。
 * 現行 UI（#21/#10 後）: モジュールごとのセクションに組み込みブックが並び、
 * 末尾に「カスタムブック」セクション（カスタム未作成なら空状態文言が出るのは正常）。
 */
import { test, expect } from '@playwright/test'

test('ブック管理: 組み込みブックが表示される', async ({ page }) => {
  await page.goto('/admin/books', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'ブック/モジュール管理' })).toBeVisible()
  // 代表的な組み込みブック（api_name の code 表示）がモジュールセクション内に並ぶ
  await expect(page.locator('code', { hasText: /^accounts$/ })).toBeVisible()
  await expect(page.locator('code', { hasText: /^opportunities$/ })).toBeVisible()
  // 各ブック行に「フィールド管理」リンクがある（ブックが一つもないバグの再発防止）
  expect(await page.getByRole('link', { name: /フィールド管理/ }).count()).toBeGreaterThan(0)
  await page.screenshot({ path: 'test-results/admin-books.png', fullPage: false })
})
