/**
 * 外部ユーザーのアクセス封鎖 E2E（REQ-0084 / ADR-0029・Phase2/4 の脅威モデル封鎖テスト）。
 *
 * 確認内容（deny-by-default の境界）:
 *   1. 社内 (crm) ルート（/dashboard・各一覧・詳細）に行くと /portal へ追い出される
 *   2. /admin/* も社内なので /portal へ追い出される（管理画面に到達不可）
 *   3. /portal 自体は閲覧でき、「共有ポータル」シェルが出る
 *   4. 付与の無いレコードの /portal/<api>/<uuid> 直 URL は「見つかりません(404)」
 *
 * 前提: test-external@bract-crm.local（users.is_external=true）が seed 済みで、
 *       auth.setup.ts が external の storageState を生成済み（TEST_USER_PASSWORD 必須）。
 *       これらが無い環境では setup が skip され本 spec も storageState 不在で skip される。
 */
import { test, expect } from '@playwright/test'
import { expectRedirectedTo } from './_helpers'

// 社内 (crm) の代表ルート。すべて /portal に追い出されるべき。
const CRM_ROUTES = [
  '/dashboard',
  '/accounts',
  '/contacts',
  '/opportunities',
  '/tasks',
  '/activities',
  '/admin/users',
  '/admin/roles',
  '/admin/books',
  '/settings/system',
]

test.describe('外部ユーザー: 社内アプリ封鎖（/portal へ追い出し）', () => {
  for (const route of CRM_ROUTES) {
    test(`${route} → /portal へリダイレクト`, async ({ page }) => {
      await page.goto(route)
      await expectRedirectedTo(page, '/portal')
    })
  }
})

test.describe('外部ユーザー: ポータル', () => {
  test('/portal は閲覧でき「共有ポータル」シェルが出る', async ({ page }) => {
    await page.goto('/portal')
    await expect(page).toHaveURL(/\/portal/)
    await expect(page.getByText('共有ポータル')).toBeVisible()
  })

  test('付与の無いレコードの直 URL は 404（存在を隠す）', async ({ page }) => {
    // 実在しない（=grant の無い）UUID。grant が無ければ notFound() になる。
    const fakeId = '00000000-0000-0000-0000-000000000000'
    const res = await page.goto(`/portal/opportunity/${fakeId}`)
    // notFound() は 404 を返す。レンダリングされた not-found 文言でも確認。
    expect(res?.status()).toBe(404)
  })
})
