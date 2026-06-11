/**
 * viewer ロールの権限境界 E2E (#41)。
 *
 * 確認内容:
 *   1. 詳細ページで「編集」「削除」が表示**されない**
 *   2. /<resource>/new に直接アクセスすると /dashboard に redirect
 *      （Server Action 側の requireEditor()）
 *   3. /<resource>/<id>/edit に直接アクセスすると /dashboard に redirect
 *   4. /admin/* も /dashboard に redirect
 *
 * 前提: TEST_USER_PASSWORD で test-viewer@bract-crm.local がログイン済み
 * （auth.setup.ts が viewer の storageState を生成済み）。
 */
import { test, expect } from '@playwright/test'
import { getFirstRecordId, expectRedirectedTo } from './_helpers'

test.describe('Role matrix: viewer (読み取り専用)', () => {
  // ── 1) 編集ボタン invisible ──────────────────────────────
  test('/accounts/<id> で「編集」リンクが表示されない', async ({ page }) => {
    const id = await getFirstRecordId(page, '/accounts', 'accounts')
    test.skip(!id, 'accounts レコードが 0 件のため skip')

    await page.goto(`/accounts/${id}`)
    await expect(page.getByRole('link', { name: /編集/ })).toHaveCount(0)
  })

  test('/accounts/<id> で「削除」ボタンが表示されない', async ({ page }) => {
    const id = await getFirstRecordId(page, '/accounts', 'accounts')
    test.skip(!id, 'accounts レコードが 0 件のため skip')

    await page.goto(`/accounts/${id}`)
    await expect(page.getByRole('button', { name: /削除/ })).toHaveCount(0)
  })

  test('/contacts/<id> で「編集」リンクが表示されない', async ({ page }) => {
    const id = await getFirstRecordId(page, '/contacts', 'contacts')
    test.skip(!id, 'contacts レコードが 0 件のため skip')

    await page.goto(`/contacts/${id}`)
    await expect(page.getByRole('link', { name: /編集/ })).toHaveCount(0)
  })

  // ── 2) 新規作成 URL に弾かれる ─────────────────────────
  test('/accounts/new → /dashboard へ redirect される', async ({ page }) => {
    await page.goto('/accounts/new')
    await expectRedirectedTo(page, '/dashboard')
  })

  test('/contacts/new → /dashboard へ redirect される', async ({ page }) => {
    await page.goto('/contacts/new')
    await expectRedirectedTo(page, '/dashboard')
  })

  test('/opportunities/new → /dashboard へ redirect される', async ({ page }) => {
    await page.goto('/opportunities/new')
    await expectRedirectedTo(page, '/dashboard')
  })

  // ── 3) 編集 URL に弾かれる ─────────────────────────────
  test('/accounts/<id>/edit → /dashboard へ redirect される', async ({ page }) => {
    const id = await getFirstRecordId(page, '/accounts', 'accounts')
    test.skip(!id, 'accounts レコードが 0 件のため skip')

    await page.goto(`/accounts/${id}/edit`)
    await expectRedirectedTo(page, '/dashboard')
  })

  test('/contacts/<id>/edit → /dashboard へ redirect される', async ({ page }) => {
    const id = await getFirstRecordId(page, '/contacts', 'contacts')
    test.skip(!id, 'contacts レコードが 0 件のため skip')

    await page.goto(`/contacts/${id}/edit`)
    await expectRedirectedTo(page, '/dashboard')
  })

  // ── 4) /admin/* に弾かれる ─────────────────────────────
  test('/admin/books → /dashboard へ redirect される', async ({ page }) => {
    await page.goto('/admin/books')
    await expectRedirectedTo(page, '/dashboard')
  })

  test('/admin/audit-log → /dashboard へ redirect される', async ({ page }) => {
    await page.goto('/admin/audit-log')
    await expectRedirectedTo(page, '/dashboard')
  })
})
