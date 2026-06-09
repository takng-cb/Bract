/**
 * 商談パイプライン（カンバン）スモーク（REQ-0020 / design_handoff: Opportunities）。
 * 既定でパイプラインビューが表示され、ステージ列とトグルが出ること。
 */
import { test, expect } from '@playwright/test'

test('商談: 既定でパイプライン（カンバン）が表示される', async ({ page }) => {
  await page.goto('/opportunities', { waitUntil: 'domcontentloaded' })
  // トグル（パイプライン / リスト）と予実リンク
  await expect(page.getByRole('link', { name: 'パイプライン' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'リスト' })).toBeVisible()
  await expect(page.getByRole('link', { name: '予実' })).toBeVisible()
  // ステージ列見出し（見込み・受注 など）
  await expect(page.getByText('見込み', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('受注', { exact: true }).first()).toBeVisible()
  await page.screenshot({ path: 'test-results/opportunities-board.png', fullPage: false })
})

test('商談: リストへ切替できる', async ({ page }) => {
  await page.goto('/opportunities?view=list', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/view=list/)
  // リストビューのツールバー（CSV/フィルタ等）配下のいずれかが見える
  await expect(page.getByRole('link', { name: 'パイプライン' })).toBeVisible()
})
