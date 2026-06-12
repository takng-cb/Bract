/**
 * クイック操作の AI作成フロー（REQ-0061 後）。
 * モジュール/ブック選択なしで即入力パネルが開き、対象ブックは AI が推論する。
 * 関連先ピッカーは入力画面ではなく確認画面に移動したため、ここでは
 * 「入力パネルが開く・解析ボタンが入力に応じて活性化する」構造のみ検証する
 * （AI 実呼び出しはしない）。
 */
import { test, expect } from '@playwright/test'
import { clickUntilVisible } from './_helpers'

test('クイック操作: AI作成は即入力パネル（ToDo 文面で解析ボタンが活性化）', async ({ page }) => {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  // hydration 前のクリック取りこぼし対策（開くまでリトライ）
  await clickUntilVisible(page, page.getByTestId('quick-launcher-open'), page.getByRole('heading', { name: 'クイック操作' }))
  await page.getByRole('button', { name: 'レコード作成' }).click()
  await page.getByRole('button', { name: 'AI作成' }).click()

  // モジュール/ブック選択を経ず、即 AI 入力パネル
  await expect(page.getByRole('heading', { name: 'AI作成' })).toBeVisible()
  const textarea = page.locator('textarea')
  await expect(textarea).toBeVisible()

  // 入力が空のうちは解析ボタンは disabled
  const analyze = page.getByRole('button', { name: 'AIで解析' })
  await expect(analyze).toBeVisible()
  await expect(analyze).toBeDisabled()

  // ToDo 文面を入れると活性化（実際の解析は行わない）
  await textarea.fill('明日15時に見積提出のToDo')
  await expect(analyze).toBeEnabled()
  await page.screenshot({ path: 'test-results/ai-create-task.png', fullPage: false })
})
