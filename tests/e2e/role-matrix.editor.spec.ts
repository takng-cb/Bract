/**
 * editor ロールの権限境界 E2E (#41)。
 *
 * 確認内容:
 *   1. 編集ボタンが詳細ページに表示される（accounts / contacts / opportunities）
 *   2. /admin/* に直接アクセスすると /dashboard に redirect される
 *      （Server Action 側の requireAdmin() + page 側の admin guard）
 *
 * 前提: TEST_USER_PASSWORD で test-editor@bract-crm.local がログイン済み
 * （auth.setup.ts が editor の storageState を生成済み）。
 */
import { test, expect } from '@playwright/test'
import { getFirstRecordId, expectRedirectedTo } from './_helpers'

test.describe('Role matrix: editor (編集可・admin 不可)', () => {
  // ── 1) 編集ボタン visible ─────────────────────────────────
  test('/accounts/<id> で「編集」リンクが表示される', async ({ page }) => {
    const id = await getFirstRecordId(page, '/accounts', 'accounts')
    test.skip(!id, 'accounts レコードが 0 件のため skip')

    await page.goto(`/accounts/${id}`)
    await expect(page.getByRole('link', { name: /編集/ })).toBeVisible()
  })

  test('/contacts/<id> で「編集」リンクが表示される', async ({ page }) => {
    const id = await getFirstRecordId(page, '/contacts', 'contacts')
    test.skip(!id, 'contacts レコードが 0 件のため skip')

    await page.goto(`/contacts/${id}`)
    await expect(page.getByRole('link', { name: /編集/ })).toBeVisible()
  })

  test('/opportunities/<id> で「編集」リンクが表示される', async ({ page }) => {
    const id = await getFirstRecordId(page, '/opportunities', 'opportunities')
    test.skip(!id, 'opportunities レコードが 0 件のため skip')

    await page.goto(`/opportunities/${id}`)
    await expect(page.getByRole('link', { name: /編集/ })).toBeVisible()
  })

  // ── 2) /admin/* に弾かれる ─────────────────────────────────
  test('/admin/books → /dashboard へ redirect される', async ({ page }) => {
    await page.goto('/admin/books')
    await expectRedirectedTo(page, '/dashboard')
  })

  test('/admin/users → /dashboard へ redirect される', async ({ page }) => {
    await page.goto('/admin/users')
    await expectRedirectedTo(page, '/dashboard')
  })

  test('/admin/audit-log → /dashboard へ redirect される', async ({ page }) => {
    await page.goto('/admin/audit-log')
    await expectRedirectedTo(page, '/dashboard')
  })

  test('/admin/relationships → /dashboard へ redirect される', async ({ page }) => {
    await page.goto('/admin/relationships')
    await expectRedirectedTo(page, '/dashboard')
  })

  test('/admin/import-logs → /dashboard へ redirect される', async ({ page }) => {
    await page.goto('/admin/import-logs')
    await expectRedirectedTo(page, '/dashboard')
  })
})
