import { test, expect } from '@playwright/test'
test('整備詳細: Google Drive リンク欄', async ({ page }) => {
  await page.goto('/maintenance?view=list', { waitUntil: 'domcontentloaded' })
  await page.locator('a[href^="/maintenance/"]:not([href^="/maintenance/new"]):not([href^="/maintenance?"])').first().click()
  await expect(page).toHaveURL(/\/maintenance\/[0-9a-f-]{36}/)
  // 全体タブに切替（あれば）
  const zentai = page.getByRole('button', { name: '全体' }).or(page.getByText('全体', { exact: true })).first()
  if (await zentai.count()) await zentai.click().catch(() => {})
  await expect(page.getByText('Google Drive / 外部リンク')).toBeVisible({ timeout: 10000 })
  await page.screenshot({ path: 'test-results/maintenance-drive.png', fullPage: false })
})
