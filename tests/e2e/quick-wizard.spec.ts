/**
 * クイック操作ウィザード スモーク（REQ-0022）。
 * ① 作成/閲覧 → ② AI/手動 → モジュール → ブック の段階フローが進み、
 * 「手動入力」で新規作成ページへ、「閲覧」で一覧ページへ遷移することを検証。
 */
import { test, expect } from '@playwright/test'

test('クイック操作: 作成→手動→モジュール→ブック で新規ページへ遷移', async ({ page }) => {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })

  // デスクトップの「クイック操作」ボタンを開く
  await page.getByTestId('quick-launcher-open').click()
  await expect(page.getByRole('heading', { name: 'クイック操作' })).toBeVisible()

  // ① レコード作成
  await page.getByRole('button', { name: 'レコード作成' }).click()
  // ② 手動入力
  await page.getByRole('button', { name: '手動入力' }).click()
  // モジュール選択（CRM コアは常時有効）
  await expect(page.getByRole('heading', { name: 'モジュールを選択' })).toBeVisible()
  await page.getByRole('button', { name: /CRM/ }).first().click()
  // ブック選択 → 取引先
  await page.getByRole('button', { name: '取引先' }).first().click()

  await expect(page).toHaveURL(/\/accounts\/new/)
})

test('クイック操作: 閲覧→モジュール→ブック で一覧ページへ遷移', async ({ page }) => {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })

  await page.getByTestId('quick-launcher-open').click()
  await page.getByRole('button', { name: 'レコード閲覧' }).click()
  await expect(page.getByRole('heading', { name: '閲覧するモジュール' })).toBeVisible()
  await page.getByRole('button', { name: /CRM/ }).first().click()
  await page.getByRole('button', { name: '取引先' }).first().click()

  await expect(page).toHaveURL(/\/accounts(\?|$)/)
})
