import { test, expect } from '@playwright/test'

// REQ-0059/0060: AIで検索はブック選択を経ず会話パネルが直接開く（対象もAIが推論）
test('クイック操作: AIで検索 → 会話パネルが直接開く', async ({ page }) => {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await page.getByTestId('quick-launcher-open').click()
  await page.getByRole('button', { name: 'AIで検索' }).click()
  await expect(page.getByRole('heading', { name: /AI検索/ })).toBeVisible()
  // 左=会話の入力欄、右=対象ブックのセレクトと適用ボタン
  await expect(page.getByLabel('AI検索の発話入力')).toBeVisible()
  await expect(page.getByLabel('検索対象のブック')).toBeVisible()
  await expect(page.getByRole('button', { name: /一覧を開く/ })).toBeVisible()
  await page.screenshot({ path: 'test-results/ai-search.png', fullPage: false })
})
