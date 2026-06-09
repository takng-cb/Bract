/**
 * ステータス矢羽根（StageBar）スモーク（REQ-0020）。案件・スタッフ・車両の詳細で矢羽根が出ること。
 */
import { test, expect } from '@playwright/test'

async function openFirstDetail(page: import('@playwright/test').Page, list: string, prefix: string) {
  await page.goto(list, { waitUntil: 'domcontentloaded' })
  await page.locator(`a[href^="${prefix}/"]:not([href^="${prefix}/new"]):not([href^="${prefix}?"])`).first().click()
  await expect(page).toHaveURL(new RegExp(`${prefix.replace('/', '\\/')}\\/[0-9a-f-]{36}`))
}

test('案件詳細: ステータス矢羽根', async ({ page }) => {
  await openFirstDetail(page, '/assignments', '/assignments')
  await expect(page.getByRole('button', { name: /受付|打診中|確定|完了/ }).first()).toBeVisible()
  await page.screenshot({ path: 'test-results/status-assignment.png', fullPage: false })
})

test('スタッフ詳細: ステータス矢羽根', async ({ page }) => {
  await openFirstDetail(page, '/staff', '/staff')
  await expect(page.getByRole('button', { name: /稼働中|一時休止|引退/ }).first()).toBeVisible()
  await page.screenshot({ path: 'test-results/status-staff.png', fullPage: false })
})

test('車両詳細: ステータス矢羽根', async ({ page }) => {
  await openFirstDetail(page, '/vehicles', '/vehicles')
  await expect(page.getByRole('button', { name: /在庫|車検中|販売済|廃車/ }).first()).toBeVisible()
  await page.screenshot({ path: 'test-results/status-vehicle.png', fullPage: false })
})

test('物件詳細: ステータス矢羽根', async ({ page }) => {
  await openFirstDetail(page, '/properties', '/properties')
  await expect(page.getByRole('button', { name: /募集中|提案中|交渉中|成約|終了/ }).first()).toBeVisible()
  await page.screenshot({ path: 'test-results/status-property.png', fullPage: false })
})
