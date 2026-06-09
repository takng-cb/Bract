/**
 * 詳細ヒーローヘッダ 横展開スモーク（REQ-0020）。人物・商談でヒーローが出ること＋スクショ。
 */
import { test, expect } from '@playwright/test'

test('人物詳細: ヒーローヘッダ', async ({ page }) => {
  await page.goto('/contacts', { waitUntil: 'domcontentloaded' })
  await page.locator('a[href^="/contacts/"]:not([href^="/contacts/new"]):not([href^="/contacts?"])').first().click()
  await expect(page).toHaveURL(/\/contacts\/[0-9a-f-]{36}/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.screenshot({ path: 'test-results/contact-detail.png', fullPage: false })
})

test('商談詳細: ヒーローヘッダ', async ({ page }) => {
  await page.goto('/opportunities?view=list', { waitUntil: 'domcontentloaded' })
  await page.locator('a[href^="/opportunities/"]:not([href="/opportunities/new"]):not([href^="/opportunities?"])').first().click()
  await expect(page).toHaveURL(/\/opportunities\/[0-9a-f-]{36}/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.screenshot({ path: 'test-results/opportunity-detail.png', fullPage: false })
})
