/**
 * 在庫(inventory) ERP モジュール PoC スモーク（#48）。
 * 商品/倉庫/在庫移動の一覧が開き、商品・倉庫を作成できること。
 */
import { test, expect } from '@playwright/test'

test('在庫: 一覧ページが開く（商品/倉庫/在庫移動）', async ({ page }) => {
  for (const [path, heading] of [['/products', '商品'], ['/warehouses', '倉庫'], ['/stock-movements', '在庫移動']] as const) {
    const res = await page.goto(path, { waitUntil: 'domcontentloaded' })
    expect(res?.status(), `${path} status`).toBeLessThan(400)
    await expect(page).not.toHaveURL(/\/login/)
  }
  await page.screenshot({ path: 'test-results/inventory-products.png', fullPage: false })
})

test('在庫: 商品と倉庫を作成できる', async ({ page }) => {
  const sku = `INV-${Date.now()}`
  await page.goto('/products/new', { waitUntil: 'domcontentloaded' })
  await page.locator('input[name="sku"]').fill(sku)
  await page.locator('input[name="name"]').fill('テスト商品A')
  await page.locator('input[name="unit_price"]').fill('1200')
  await page.getByRole('button', { name: /保存|作成/ }).first().click()
  await expect(page).toHaveURL(/\/products\/[0-9a-f-]{36}/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('テスト商品A')

  const code = `WH-${Date.now()}`
  await page.goto('/warehouses/new', { waitUntil: 'domcontentloaded' })
  await page.locator('input[name="code"]').fill(code)
  await page.locator('input[name="name"]').fill('本社倉庫')
  await page.getByRole('button', { name: /保存|作成/ }).first().click()
  await expect(page).toHaveURL(/\/warehouses\/[0-9a-f-]{36}/)
})
