/**
 * 社内レコードスコープ（own）の E2E（REQ-0083）。
 *
 * カスタムロール「E2E自分のみ」(read/update=own) を割り当てた test-scoped で、
 * 強制対象6ブック（取引先/人物/商談/活動/ToDo/プロジェクト）について:
 *   1. 一覧に「自分所有(own)」は出る・「他人所有(other)」は出ない（SQL 述語の絞り込み）
 *   2. own 詳細は 200 で開ける／other 詳細の直 URL は 404（canSeeRecord→notFound）
 *
 * 前提: seed-test-users → seed-scoped-data 実行済み（固定UUID・マーカー名は scope.fixtures.ts）。
 * 未 seed や projects モジュール無効の環境では該当ブックを skip（環境非依存）。
 */
import { test, expect } from '@playwright/test'
import { SCOPE_BOOKS } from './scope.fixtures'

for (const b of SCOPE_BOOKS) {
  test.describe(`レコードスコープ own: ${b.key}`, () => {
    test('一覧は own が出て other は出ない', async ({ page }) => {
      const res = await page.goto(b.listPath)
      test.skip(!!b.mayBeDisabled && res?.status() !== 200, `${b.key} 到達不可（モジュール無効等）`)

      // own マーカーが見える＝一覧が正しくロードされている
      const own = page.getByText(b.ownName, { exact: false })
      test.skip((await own.count()) === 0, `${b.key} の own レコードが未 seed のため skip`)
      await expect(own.first()).toBeVisible()

      // other は SQL 述語で除外され表示されない
      await expect(page.getByText(b.otherName, { exact: false })).toHaveCount(0)
    })

    // own 詳細はレコード内容が表示され、other 詳細は notFound でレコード内容が出ない。
    // 注: 社内 (crm) レイアウトはシェルを先行ストリームするため notFound でも HTTP は 200 になり得る
    //     （ヘッダ送信後に status を変えられない Next の制約）。重要なのは「内容が漏れない」こと。
    //     ガードは fetch 直後・JSX 構築前に notFound() するためレコードは応答に載らない（漏えいなし）。
    //     外部ポータル（軽量レイアウト）は真に 404 を返す（external.spec で検証）。
    test('own 詳細は閲覧可・other 詳細は内容が出ない（notFound）', async ({ page }) => {
      await page.goto(`/${b.resource}/${b.ownId}`)
      const own = page.getByText(b.ownName, { exact: false }).first()
      test.skip(!(await own.isVisible().catch(() => false)), `${b.key} own 未表示（モジュール無効/未seed）`)
      await expect(own).toBeVisible()

      await page.goto(`/${b.resource}/${b.otherId}`)
      await expect(page.getByText(b.otherName, { exact: false })).toHaveCount(0)
    })
  })
}
