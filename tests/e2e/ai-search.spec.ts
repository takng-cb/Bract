import { test, expect } from '@playwright/test'
test('クイック操作: AIで検索 → ToDo の入力パネル', async ({ page }) => {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await page.getByTestId('quick-launcher-open').click()
  await page.getByRole('button', { name: 'AIで検索' }).click()
  await page.getByRole('button', { name: /CRM/ }).first().click()
  await page.getByRole('button', { name: 'ToDo' }).first().click()
  await expect(page.getByRole('heading', { name: /AI検索/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'AIで条件化' })).toBeVisible()
  await page.screenshot({ path: 'test-results/ai-search.png', fullPage: false })
})
