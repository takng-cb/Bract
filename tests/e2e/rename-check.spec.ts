import { test, expect } from '@playwright/test'
test('サイドバー: 顧客管理 グループ（CRMコア廃止）', async ({ page }) => {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('顧客管理', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('CRM コア')).toHaveCount(0)
  await page.screenshot({ path: 'test-results/rename.png', fullPage: false })
})
