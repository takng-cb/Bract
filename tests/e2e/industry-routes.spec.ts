/**
 * 主要ルートのスモーク（Issue #50）。
 * モジュール有効化済み dev で、CRM＋各業種の一覧ページが 404 にならず開けることを検証。
 * （ユーザー報告: /vehicles・/parts が 404 → 業種ページの isModuleEnabled 移行を検証）
 *
 * 実行例:
 *   NEXT_PUBLIC_INDUSTRY=base BRACT_DISABLE_INDUSTRY_REDIRECTS=1 \
 *   TEST_USER_PASSWORD=... npx playwright test industry-routes
 */
import { test, expect } from '@playwright/test'

const ROUTES: { path: string; label: string }[] = [
  { path: '/dashboard',         label: 'ダッシュボード' },
  { path: '/accounts',          label: '取引先' },
  { path: '/contacts',          label: '人物' },
  { path: '/opportunities',     label: '商談' },
  { path: '/activities',        label: '活動' },
  { path: '/tasks',             label: 'ToDo' },
  { path: '/expenses',          label: '経費' },
  { path: '/vehicles',          label: '車両(板金)' },
  { path: '/parts',             label: '部品(板金)' },
  { path: '/maintenance',       label: '整備(板金)' },
  { path: '/customer-vehicles', label: '顧客車両(板金)' },
  { path: '/properties',        label: '物件(不動産)' },
  { path: '/assignments',       label: '案件(人材)' },
  { path: '/staff',             label: 'スタッフ(人材)' },
]

test.describe('主要ルート スモーク（404 でなく開ける）', () => {
  for (const r of ROUTES) {
    test(`${r.label} ${r.path} が開ける`, async ({ page }) => {
      const resp = await page.goto(r.path, { waitUntil: 'domcontentloaded' })
      expect(resp, `${r.path}: レスポンスなし`).toBeTruthy()
      // notFound() は HTTP 404 を返す
      expect(resp!.status(), `${r.path}: HTTP status`).toBeLessThan(400)
      // /login に飛ばされていない（＝認証済みで本来のページが出ている）
      expect(page.url(), `${r.path}: login に飛んでいる`).not.toContain('/login')
    })
  }
})
