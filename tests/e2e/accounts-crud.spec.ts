/**
 * 取引先 (accounts) の CRUD E2E。
 * admin としてログインした状態で、以下のシナリオを通す:
 *   1. 一覧から新規作成画面へ
 *   2. 必須フィールドを入力して保存
 *   3. 詳細画面に表示される
 *   4. 編集 → 名前を変更 → 保存
 *   5. 詳細画面に変更が反映されている
 *   6. 削除（テストデータの後始末）
 *
 * 注意: 本テストは DB に行を書く。テスト用 Neon (`bract-base` 等) に対して
 *       走らせるか、本番に対してでも識別可能な名前のレコードを使うこと。
 */
import { test, expect } from '@playwright/test'

const UNIQUE = `e2e-test-${Date.now()}`
const ACCOUNT_NAME = `Playwright E2E ${UNIQUE}`
const RENAMED_NAME = `${ACCOUNT_NAME} (renamed)`

test.describe('Accounts CRUD (admin)', () => {
  test('新規作成 → 表示 → 編集 → 削除', async ({ page }) => {
    // 1. 一覧 → 新規作成
    await page.goto('/accounts')
    await expect(page.locator('h1')).toContainText('取引先')
    await page.getByRole('link', { name: /新規作成/ }).first().click()
    await expect(page).toHaveURL(/\/accounts\/new/)

    // 2. 必須項目入力
    await page.locator('input[name="name"]').fill(ACCOUNT_NAME)
    await page.locator('button[type="submit"]').first().click()

    // 3. 詳細画面に遷移、名前が表示される
    await page.waitForURL(/\/accounts\/[0-9a-f-]{36}$/, { timeout: 10_000 })
    await expect(page.locator('h1')).toContainText(ACCOUNT_NAME)

    // 4. 編集ボタン → 名前変更 → 保存
    await page.getByRole('link', { name: /編集/ }).first().click()
    await expect(page).toHaveURL(/\/accounts\/[0-9a-f-]{36}\/edit/)
    await page.locator('input[name="name"]').fill(RENAMED_NAME)
    await page.locator('button[type="submit"]').first().click()

    // 5. 変更反映
    await page.waitForURL(/\/accounts\/[0-9a-f-]{36}$/, { timeout: 10_000 })
    await expect(page.locator('h1')).toContainText(RENAMED_NAME)

    // 6. 削除 (confirm dialog を accept)
    page.on('dialog', (d) => d.accept())
    await page.getByRole('button', { name: /削除/ }).first().click()

    // /accounts に戻る
    await page.waitForURL(/\/accounts(\?|$)/, { timeout: 10_000 })
    // 削除した名前が一覧に存在しない
    await expect(page.getByText(RENAMED_NAME)).toHaveCount(0, { timeout: 5_000 })
  })
})
