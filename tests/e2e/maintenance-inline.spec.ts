/**
 * 整備フォームのインライン作成スモーク（#45 / REQ-0042 で SearchCreateCombo 化）。
 * 現行 UI: 「＋ 新規作成」ボタン＋モーダルは廃止され、
 * 検索コンボに入力 → 候補に無ければ「保存時に新規登録します」ヒントが出て、
 * 整備の保存時にまとめて作成・紐付けされる。
 * ここでは検索→新規ヒント表示（取引先・顧客車両）と、新規車両時の車名欄の出現を検証する。
 */
import { test, expect } from '@playwright/test'

const UNIQUE = Date.now().toString().slice(-6)

test('整備新規: 取引先・顧客車両を検索コンボからインライン新規指定できる', async ({ page }) => {
  await page.goto('/maintenance/new', { waitUntil: 'domcontentloaded' })

  // 取引先コンボ: 候補に無い名前を入れると「保存時に新規登録」ヒントが出る
  const accountInput = page.getByPlaceholder('会社名を入力（空のまま＝個人のお客様）')
  await accountInput.fill(`インラインテスト商会${UNIQUE}`)
  await expect(
    page.getByText(`保存時に「インラインテスト商会${UNIQUE}」を新規取引先として登録します`),
  ).toBeVisible({ timeout: 10_000 })

  // 顧客車両コンボ: 候補に無いナンバーを入れると新規車両ヒント＋車名入力欄が出る
  const vehicleInput = page.getByPlaceholder('例: 35-89、ノート')
  await vehicleInput.fill(`品川 300 あ ${UNIQUE.slice(0, 2)}-${UNIQUE.slice(2, 4)}`)
  await expect(page.getByText(/をナンバーとして新規車両を登録します/)).toBeVisible({ timeout: 10_000 })
  await expect(page.getByPlaceholder('例: 日産 ノート')).toBeVisible()

  await page.screenshot({ path: 'test-results/maintenance-inline.png', fullPage: false })
})
