/**
 * auto-body 業種オーバーレイの利益計算 E2E (#40 Sprint 2)。
 *
 * 検証内容:
 *   1. 商談新規作成画面に「サービス区分」「部品仕入原価」フィールドが存在
 *   2. amount=30万 / parts_cost=10万 → 利益 = 30万 - 10万 = 20万 で表示される
 *   3. 保存後、詳細ページの「自動車整備情報」セクションに上記の値が表示
 *
 * 対象 deploy: BASE_URL が auto-body バリアント (bract-crm-auto-body.vercel.app)
 * を指している場合のみ実行。他業種なら test.skip。
 *
 * 前提: admin ログイン (chromium-admin project)。
 */
import { test, expect } from '@playwright/test'

const UNIQUE = `e2e-ab-${Date.now()}`
const NAME = `Playwright AB Profit ${UNIQUE}`

test.describe('auto-body: 利益計算 (amount - parts_cost)', () => {
  test('整備 売上 30 万・原価 10 万 → 利益 20 万が詳細ページに反映', async ({ page }) => {
    await page.goto('/opportunities/new')

    // auto-body モード判定: service_type select の存在で
    const serviceTypeSelect = page.locator('select[name="service_type"]')
    if (await serviceTypeSelect.count() === 0) {
      test.skip(true, 'auto-body バリアントではない (service_type field 不在)')
    }

    // ── 入力 ───────────────────────────────────────────
    await page.locator('input[name="name"]').fill(NAME)
    await page.locator('input[name="amount"]').fill('300000')        // 売上 30 万
    await serviceTypeSelect.selectOption('整備')                       // サービス区分
    // vehicle_id select は車両が無くても empty で OK
    await page.locator('input[name="parts_cost"]').fill('100000')    // 部品原価 10 万

    // ── 保存 ───────────────────────────────────────────
    await page.locator('button[type="submit"]').first().click()
    await page.waitForURL(/\/opportunities\/[0-9a-f-]{36}$/, { timeout: 15_000 })

    // ── 詳細ページの検証 ───────────────────────────────
    await expect(page.locator('h1')).toContainText(NAME)
    await expect(page.getByText(/自動車整備情報/)).toBeVisible()

    // サービス区分 整備
    await expect(page.getByText(/整備/).first()).toBeVisible()

    // 売上 ¥300,000
    await expect(page.getByText(/¥300,000|￥300,000/)).toBeVisible()
    // 部品仕入原価 ¥100,000
    await expect(page.getByText(/¥100,000|￥100,000/)).toBeVisible()
    // 利益 ¥200,000
    await expect(page.getByText(/¥200,000|￥200,000/)).toBeVisible()

    // ── テストデータ後始末 ─────────────────────────────
    page.on('dialog', (d) => d.accept())
    const deleteBtn = page.getByRole('button', { name: /削除/ }).first()
    if (await deleteBtn.count() > 0) {
      await deleteBtn.click()
      await page.waitForURL(/\/opportunities(\?|$)/, { timeout: 10_000 })
    }
  })

  test('車両販売 売上 100 万・原価 70 万 → 利益 30 万', async ({ page }) => {
    await page.goto('/opportunities/new')

    const serviceTypeSelect = page.locator('select[name="service_type"]')
    if (await serviceTypeSelect.count() === 0) {
      test.skip(true, 'auto-body バリアントではない')
    }

    const NAME_SALE = `Playwright AB Vehicle Sale ${UNIQUE}`
    await page.locator('input[name="name"]').fill(NAME_SALE)
    await page.locator('input[name="amount"]').fill('1000000')
    await serviceTypeSelect.selectOption('車両販売')
    await page.locator('input[name="parts_cost"]').fill('700000')

    await page.locator('button[type="submit"]').first().click()
    await page.waitForURL(/\/opportunities\/[0-9a-f-]{36}$/, { timeout: 15_000 })

    await expect(page.locator('h1')).toContainText(NAME_SALE)
    await expect(page.getByText(/車両販売/).first()).toBeVisible()
    // 利益 ¥300,000
    await expect(page.getByText(/¥300,000|￥300,000/)).toBeVisible()

    // 後始末
    page.on('dialog', (d) => d.accept())
    const deleteBtn = page.getByRole('button', { name: /削除/ }).first()
    if (await deleteBtn.count() > 0) {
      await deleteBtn.click()
      await page.waitForURL(/\/opportunities(\?|$)/, { timeout: 10_000 })
    }
  })
})
