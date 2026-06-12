/**
 * CRM コア AI 作成の導線スモーク（#49 / REQ-0061 改定後）。
 * クイック操作 → レコード作成 → AI作成 で、モジュール/ブック選択なしに
 * テキスト/URL/画像の入力パネルが即座に開くこと
 * （対象ブックは AI が推論。実際の抽出は AI プロバイダ設定に依存するため呼ばない）。
 */
import { test, expect } from '@playwright/test'
import { clickUntilVisible } from './_helpers'

test('クイック操作: AI 作成入力パネルが開く（テキスト/URL/画像）', async ({ page }) => {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  // hydration 前のクリック取りこぼし対策（開くまでリトライ）
  await clickUntilVisible(page, page.getByTestId('quick-launcher-open'), page.getByRole('heading', { name: 'クイック操作' }))
  await page.getByRole('button', { name: 'レコード作成' }).click()
  await page.getByRole('button', { name: 'AI作成' }).click()

  // AI 入力パネル（準備中ではなく、テキスト＋URL＋画像＋解析ボタン）
  await expect(page.getByRole('heading', { name: 'AI作成' })).toBeVisible()
  await expect(page.locator('textarea')).toBeVisible()
  await expect(page.getByPlaceholder('https://example.co.jp')).toBeVisible()
  await expect(page.getByText('画像（名刺等）から読み取る')).toBeVisible()
  await expect(page.getByRole('button', { name: 'AIで解析' })).toBeVisible()
  await page.screenshot({ path: 'test-results/crm-ai-create.png', fullPage: false })
})
