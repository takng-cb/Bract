/**
 * admin ロールの権限境界 E2E (#41)。
 * admin が管理画面群に問題なく到達できることを確認。
 *
 * ファイル名規約: *.admin.spec.ts は playwright.config.ts の
 * chromium-admin project (testIgnore で .editor.spec / .viewer.spec を除外)
 * で実行される。明示的に admin で確認したい boundary をここに集約する。
 */
import { test, expect } from '@playwright/test'

test.describe('Role matrix: admin (管理画面到達)', () => {
  test('/admin/books に到達できる', async ({ page }) => {
    await page.goto('/admin/books')
    await expect(page.locator('h1')).toContainText('オブジェクト管理')
  })

  test('/admin/users に到達できる', async ({ page }) => {
    await page.goto('/admin/users')
    await expect(page.locator('h1')).toContainText(/ユーザー|ユーザ管理/)
  })

  test('/admin/audit-log に到達できる', async ({ page }) => {
    await page.goto('/admin/audit-log')
    await expect(page.locator('h1')).toContainText('監査ログ')
  })

  test('/admin/relationships に到達できる', async ({ page }) => {
    await page.goto('/admin/relationships')
    await expect(page.locator('h1')).toContainText(/関係性|関連/)
  })

  test('/admin/import-logs に到達できる', async ({ page }) => {
    await page.goto('/admin/import-logs')
    await expect(page.locator('h1')).toContainText('インポートログ')
  })
})
