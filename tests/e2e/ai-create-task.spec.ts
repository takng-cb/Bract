import { test, expect } from '@playwright/test'
test('クイック操作: ToDo の AI作成（関連先 + 入力パネル）', async ({ page }) => {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await page.getByTestId('quick-launcher-open').click()
  await page.getByRole('button', { name: 'レコード作成' }).click()
  await page.getByRole('button', { name: 'AI作成' }).click()
  await page.getByRole('button', { name: /CRM|顧客管理/ }).first().click()
  await page.getByRole('button', { name: 'ToDo' }).first().click()
  await expect(page.getByText('関連先（任意・取引先/人物/商談に紐づけ）')).toBeVisible()
  await expect(page.getByRole('button', { name: 'AIで解析' })).toBeVisible()
  await page.screenshot({ path: 'test-results/ai-create-task.png', fullPage: false })
})
