/**
 * CRM コア AI 作成の導線スモーク（#49）。
 * クイック操作の AI作成 → CRMコア → 取引先 で、テキスト/URL/画像の入力パネルが出ること
 * （= typed ブックでも AI 作成導線が有効。実際の抽出は AI プロバイダ設定に依存）。
 */
import { test, expect } from '@playwright/test'

test('クイック操作: 取引先の AI 作成入力パネルが開く（テキスト/URL/画像）', async ({ page }) => {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await page.getByTestId('quick-launcher-open').click()
  await page.getByRole('button', { name: 'レコード作成' }).click()
  await page.getByRole('button', { name: 'AI作成' }).click()
  await page.getByRole('button', { name: /CRM/ }).first().click()
  await page.getByRole('button', { name: '取引先' }).first().click()

  // AI 入力パネル（準備中ではなく、テキスト＋URL＋画像＋解析ボタン）
  await expect(page.getByRole('heading', { name: /AI作成/ })).toBeVisible()
  await expect(page.getByPlaceholder('https://example.co.jp')).toBeVisible()
  await expect(page.getByRole('button', { name: 'AIで解析' })).toBeVisible()
  await page.screenshot({ path: 'test-results/crm-ai-create.png', fullPage: false })
})
