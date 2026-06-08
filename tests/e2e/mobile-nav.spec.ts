/**
 * モバイル スモーク（Issue #50 / REQ-0020）。
 * モバイル幅で上部バーのハンバーガー→ドロワー（モバイルのサイドバー）が開き、
 * モジュール項目・ログアウトが表示されることを検証。
 */
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

test('モバイルのサイドバー（ドロワー）が開きナビ項目が出る', async ({ page }) => {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  // 上部バーのハンバーガー
  await page.getByRole('button', { name: 'メニューを開く' }).click()
  // ドロワー内のナビ項目（モジュール基準）
  await expect(page.getByRole('link', { name: '取引先' })).toBeVisible()
  await expect(page.getByRole('link', { name: '人物' })).toBeVisible()
  // ログアウト（Lucide アイコン＋ラベル）
  await expect(page.getByRole('button', { name: 'ログアウト' })).toBeVisible()
})

test('モバイル下部タブの中央 FAB が表示される', async ({ page }) => {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: 'クイック登録' })).toBeVisible()
})
