import { test, expect } from '@playwright/test'

test('Wiki: ページ作成と Markdown 描画', async ({ page }) => {
  await page.goto('/wiki/new', { waitUntil: 'domcontentloaded' })
  await page.locator('input[name="title"]').fill('テストWikiページ')
  await page.locator('textarea').first().fill('# 見出しテスト\n\n本文 **太字** と項目\n\n- 項目A\n- 項目B')
  await page.getByRole('button', { name: /保存|作成/ }).first().click()
  await expect(page).toHaveURL(/\/wiki\/[0-9a-f-]{36}/)
  await expect(page.getByRole('heading', { name: 'テストWikiページ', level: 1 })).toBeVisible()
  // Markdown 描画（見出し・リスト）
  await expect(page.getByText('見出しテスト')).toBeVisible()
  await expect(page.getByText('項目A')).toBeVisible()
  await page.screenshot({ path: 'test-results/wiki-detail.png', fullPage: false })
})

test('Wiki: 一覧が開く', async ({ page }) => {
  await page.goto('/wiki', { waitUntil: 'domcontentloaded' })
  await expect(page).not.toHaveURL(/\/login/)
  await page.screenshot({ path: 'test-results/wiki-list.png', fullPage: false })
})
