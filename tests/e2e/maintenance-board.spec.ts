/**
 * 整備カンバン スモーク（REQ-0020 / design_handoff: Maintenance）。
 * 既定でボード（ステータス列＋統計）が表示され、ボード/リスト切替ができること。
 */
import { test, expect } from '@playwright/test'

test('整備: 既定でボード（カンバン）と統計が表示される', async ({ page }) => {
  await page.goto('/maintenance', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('link', { name: 'ボード', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'リスト', exact: true })).toBeVisible()
  // 統計カードのラベル
  await expect(page.getByText('作業中の車両', { exact: true })).toBeVisible()
  await expect(page.getByText('部品待ち', { exact: true }).first()).toBeVisible()
  await page.screenshot({ path: 'test-results/maintenance-board.png', fullPage: false })
})

test('整備: リストへ切替できる', async ({ page }) => {
  await page.goto('/maintenance?view=list', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/view=list/)
  await expect(page.getByRole('link', { name: 'ボード', exact: true })).toBeVisible()
})
