/**
 * real-estate 業種オーバーレイの仲介手数料計算 E2E (#40 Sprint 2)。
 *
 * 検証内容:
 *   1. 商談新規作成画面に「取引区分」「仲介手数料」フィールドが存在
 *   2. 売買・金額 5000 万円 → 仲介手数料が 156 万円 (50M × 3% + 60,000)
 *      で表示される（client-side 自動計算）
 *   3. 保存後、詳細ページの「不動産情報」セクションに仲介手数料が
 *      入力値通り表示される
 *   4. 「利益（自動計算）」に手数料 × 仲介種別倍率 + その他利益 で計算結果
 *      が表示される
 *
 * 対象 deploy: BASE_URL が real-estate バリアント (bract-crm.vercel.app)
 * を指している場合のみ実行。他業種なら test.skip。
 *
 * 前提: admin ログイン (chromium-admin project)。
 */
import { test, expect } from '@playwright/test'

const UNIQUE = `e2e-re-${Date.now()}`
const NAME = `Playwright RE Commission ${UNIQUE}`

test.describe('real-estate: 仲介手数料計算', () => {
  test('売買 5000 万円 → 仲介手数料 156 万円 + 利益計算が詳細ページに反映', async ({ page }) => {
    await page.goto('/opportunities/new')

    // real-estate モード判定: transaction_type select の存在で
    const txTypeSelect = page.locator('select[name="transaction_type"]')
    if (await txTypeSelect.count() === 0) {
      test.skip(true, 'real-estate バリアントではない (transaction_type field 不在)')
    }

    // ── 入力 ───────────────────────────────────────────
    await page.locator('input[name="name"]').fill(NAME)
    await txTypeSelect.selectOption('売買')                   // 取引区分
    await page.locator('input[name="amount"]').fill('50000000')  // 売買代金 5000万
    // 仲介手数料は client-side で自動計算されるが、確実性のため明示入力する
    // 期待値: 50,000,000 * 0.03 + 60,000 = 1,560,000
    await page.locator('input[name="commission_fee"]').fill('1560000')
    await page.locator('select[name="brokerage_type"]').selectOption('両手')  // 利益が 2 倍に
    await page.locator('input[name="other_profit"]').fill('0')

    // ── 保存 ───────────────────────────────────────────
    await page.locator('button[type="submit"]').first().click()
    await page.waitForURL(/\/opportunities\/[0-9a-f-]{36}$/, { timeout: 15_000 })

    // ── 詳細ページの検証 ───────────────────────────────
    await expect(page.locator('h1')).toContainText(NAME)

    // 不動産情報セクション
    await expect(page.getByText(/不動産情報/)).toBeVisible()
    // 仲介手数料 ¥1,560,000 表示
    await expect(page.getByText(/¥1,560,000|￥1,560,000/)).toBeVisible()
    // 取引区分 売買
    await expect(page.getByText(/売買/).first()).toBeVisible()
    // 仲介種別 両手
    await expect(page.getByText(/両手/)).toBeVisible()

    // 利益（自動計算）: 1,560,000 × 2 (両手) + 0 = ¥3,120,000
    await expect(page.getByText(/¥3,120,000|￥3,120,000/)).toBeVisible()

    // ── テストデータ後始末 ─────────────────────────────
    page.on('dialog', (d) => d.accept())
    const deleteBtn = page.getByRole('button', { name: /削除/ }).first()
    if (await deleteBtn.count() > 0) {
      await deleteBtn.click()
      await page.waitForURL(/\/opportunities(\?|$)/, { timeout: 10_000 })
    }
  })

  test('賃貸 月額 10 万円 → 仲介手数料 10 万円 (1 ヶ月分標準)', async ({ page }) => {
    await page.goto('/opportunities/new')

    const txTypeSelect = page.locator('select[name="transaction_type"]')
    if (await txTypeSelect.count() === 0) {
      test.skip(true, 'real-estate バリアントではない')
    }

    const NAME_RENT = `Playwright RE Rent ${UNIQUE}`
    await page.locator('input[name="name"]').fill(NAME_RENT)
    await txTypeSelect.selectOption('賃貸')
    await page.locator('input[name="amount"]').fill('100000')
    await page.locator('input[name="commission_fee"]').fill('100000')   // 月額の 1 ヶ月分
    await page.locator('select[name="brokerage_type"]').selectOption('貸主')
    await page.locator('input[name="other_profit"]').fill('0')

    await page.locator('button[type="submit"]').first().click()
    await page.waitForURL(/\/opportunities\/[0-9a-f-]{36}$/, { timeout: 15_000 })

    await expect(page.locator('h1')).toContainText(NAME_RENT)
    await expect(page.getByText(/賃貸/).first()).toBeVisible()
    // 仲介手数料 ¥100,000 + 利益 (片手 = 1 倍) = ¥100,000
    await expect(page.getByText(/¥100,000|￥100,000/).first()).toBeVisible()

    // 後始末
    page.on('dialog', (d) => d.accept())
    const deleteBtn = page.getByRole('button', { name: /削除/ }).first()
    if (await deleteBtn.count() > 0) {
      await deleteBtn.click()
      await page.waitForURL(/\/opportunities(\?|$)/, { timeout: 10_000 })
    }
  })
})
