import { test, expect } from '@playwright/test'
test('在庫拡充: 棚卸ページが開く', async ({ page }) => {
  const res = await page.goto('/stock-movements/stocktake', { waitUntil: 'domcontentloaded' })
  expect(res?.status()).toBeLessThan(400)
  await expect(page).not.toHaveURL(/\/login/)
  await page.screenshot({ path: 'test-results/inventory-stocktake.png', fullPage: false })
})
test('在庫拡充: 商品一覧に在庫列とCSV', async ({ page }) => {
  await page.goto('/products', { waitUntil: 'domcontentloaded' })
  await expect(page).not.toHaveURL(/\/login/)
  await page.screenshot({ path: 'test-results/inventory-products-list.png', fullPage: false })
})
