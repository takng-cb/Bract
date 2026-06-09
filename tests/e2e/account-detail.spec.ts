/**
 * 取引先詳細ヘッダ（ヒーロー）スモーク（REQ-0020 / design_handoff: Account Detail）。
 * アバター＋タイトル＋メタ行が表示されること。
 */
import { test, expect } from '@playwright/test'

test('取引先詳細: ヒーローヘッダが表示される', async ({ page }) => {
  await page.goto('/accounts', { waitUntil: 'domcontentloaded' })
  // 一覧から先頭の取引先詳細へ（/accounts/new と一覧自身は除外）
  const firstLink = page.locator('a[href^="/accounts/"]:not([href="/accounts/new"]):not([href="/accounts"])').first()
  await firstLink.click()
  await expect(page).toHaveURL(/\/accounts\/[0-9a-f-]{36}/)
  // ヒーロー：見出し(h1)＋メタの「登録」が見える
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByText('登録', { exact: false }).first()).toBeVisible()
  await page.screenshot({ path: 'test-results/account-detail.png', fullPage: false })
})
