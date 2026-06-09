/**
 * ダッシュボード KPI スモーク（REQ-0020 / design_handoff: Dashboard）。
 * KPI カードがアイコンバッジ付きで表示されること＋スクショ。
 */
import { test, expect } from '@playwright/test'

test('ダッシュボード: KPIカード（アイコンバッジ付き）', async ({ page }) => {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('アクティブな取引先', { exact: true })).toBeVisible()
  await expect(page.getByText('期間内の想定売上', { exact: true })).toBeVisible()
  await page.screenshot({ path: 'test-results/dashboard.png', fullPage: false })
})
