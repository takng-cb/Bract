/**
 * モバイル スモーク（Issue #50 / REQ-0020）。
 * モバイル幅で上部バーのハンバーガー→ドロワー（モバイルのサイドバー）が開き、
 * モジュール項目・ログアウトが表示されることを検証。
 */
import { test, expect } from '@playwright/test'
import { clickUntilVisible } from './_helpers'

test.use({ viewport: { width: 390, height: 844 } })

test('モバイルのサイドバー（ドロワー）が開きナビ項目が出る', async ({ page }) => {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  // 開く前はオーバーレイ（開いた時のみ描画）が存在しない
  await expect(page.getByTestId('mobile-drawer-overlay')).toHaveCount(0)
  // 上部バーのハンバーガー → ドロワーが開く（オーバーレイ出現＝開いた証拠）
  // hydration 前のクリック取りこぼし対策（開くまでリトライ）
  await clickUntilVisible(page, page.getByRole('button', { name: 'メニューを開く' }), page.getByTestId('mobile-drawer-overlay'))
  // ドロワー内のナビ項目・ログアウトが存在
  await expect(page.getByRole('link', { name: '取引先' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'ログアウト' })).toBeVisible()
})

test('モバイル下部タブの中央 FAB が表示される', async ({ page }) => {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  // FAB の aria-label は「クイック登録」→「クイック操作」に変更。
  // Topbar 側にも同名 title のトリガーがあるため、ds-fab（中央 FAB）に限定する
  await expect(page.locator('button.ds-fab[aria-label="クイック操作"]')).toBeVisible()
})
