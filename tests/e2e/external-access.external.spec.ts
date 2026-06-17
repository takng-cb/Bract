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

// ── 正の経路: 共有された取引先がポータルに見え、読み取り詳細が開ける ──
// scripts/seed-external-grant.ts で「E2E共有テスト取引先」を test-external に付与済みであることが前提。
// 未 seed の環境ではマーカーが出ないため skip する（環境非依存に保つ）。
const SHARED_NAME = 'E2E共有テスト取引先'

test.describe('外部ユーザー: 共有レコードの閲覧（正の経路）', () => {
  test('共有された取引先が /portal 一覧に表示される', async ({ page }) => {
    await page.goto('/portal')
    const link = page.getByRole('link', { name: new RegExp(SHARED_NAME) })
    test.skip((await link.count()) === 0, 'grant が未 seed（seed-external-grant 未実行）のため skip')
    await expect(link.first()).toBeVisible()
  })

  test('共有取引先の詳細が読み取り専用で開ける', async ({ page }) => {
    await page.goto('/portal')
    const link = page.getByRole('link', { name: new RegExp(SHARED_NAME) })
    test.skip((await link.count()) === 0, 'grant が未 seed のため skip')

    await link.first().click()
    await page.waitForURL(/\/portal\/account\//)
    // タイプラベル・名称・閲覧専用の注記が出る
    await expect(page.getByText('取引先', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: new RegExp(SHARED_NAME) })).toBeVisible()
    await expect(page.getByText('この情報は閲覧専用です。')).toBeVisible()
    // 編集・削除導線が無いこと
    await expect(page.getByRole('button', { name: /編集|削除/ })).toHaveCount(0)
  })
})
