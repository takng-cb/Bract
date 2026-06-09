/**
 * 整備フォームのインライン作成スモーク（#45）。
 * フォームを離れずに 取引先・顧客車両 を新規作成して紐付けられること。
 */
import { test, expect } from '@playwright/test'

test('整備新規: 取引先・顧客車両をインライン作成できる', async ({ page }) => {
  await page.goto('/maintenance/new', { waitUntil: 'domcontentloaded' })

  // 取引先をインライン作成（同名 dedup があるので固定名でOK）
  await page.getByRole('button', { name: '＋ 取引先を新規作成' }).click()
  await page.getByPlaceholder('取引先名（必須）').fill('インラインテスト商会')
  await page.getByRole('button', { name: 'この内容で作成' }).first().click()
  // 取引先セレクトに反映（選択値として表示）
  await expect(page.getByText('インラインテスト商会').first()).toBeVisible({ timeout: 10000 })

  // 顧客車両をインライン作成
  await page.getByRole('button', { name: '＋ 顧客車両を新規作成' }).click()
  await page.getByPlaceholder(/ナンバー/).fill('品川 300 あ 99-99')
  await page.getByRole('button', { name: 'この内容で作成' }).first().click()
  await expect(page.getByText('品川 300 あ 99-99').first()).toBeVisible({ timeout: 10000 })

  await page.screenshot({ path: 'test-results/maintenance-inline.png', fullPage: false })
})
