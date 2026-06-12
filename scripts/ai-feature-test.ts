/**
 * AI 検索 / AI 作成 の機能テストハーネス（REQ-0066）。
 *
 * 実 AI（管理画面で設定中のプロバイダ）に対して UI 経由でケースを流し、
 * 「推論されたブック・検証済み条件・関連先・エラー文言」を期待値と突き合わせる。
 * ケース一覧と期待値の意味は docs/ai-test-cases.md を参照。
 *
 * 使い方:
 *   NEXT_PUBLIC_INDUSTRY=base npx next build --webpack && npx next start -p 3100
 *   npx tsx scripts/ai-feature-test.ts            # 全ケース
 *   npx tsx scripts/ai-feature-test.ts S4 C3      # ID 指定
 *
 * 必要 env（.env.local）: TEST_USER_PASSWORD（seed-test-users のパスワード）
 * 注意:
 *   - dev のデモデータ（accounts に「ライフシステム株式会社」等）を前提とするケースがある
 *   - AI のレート制限（20回/分/ユーザー）を避けるため各 AI 呼び出し後に待機する
 *   - LLM は非決定的なため、期待値は「検証済みの構造」（ブック・フィールド・演算子・
 *     値の範囲）に対して置く。返答文の字面は検証しない
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })

import { chromium, type Page, type Locator } from '@playwright/test'

const BASE_URL = process.env.MANUAL_BASE_URL ?? 'http://localhost:3100'
const PASSWORD = process.env.TEST_USER_PASSWORD
const ADMIN = 'test-admin@bract-crm.local'
const AI_WAIT_MS = 4000   // レート制限 20回/分 を割らないための呼び出し間隔

/* ── 期待値の型 ──────────────────────────────────────────── */

type CondExpect = {
  label: string                 // 条件チップのフィールド表示名（例: '価格（円）'）
  op?: string                   // OP 表示（'＝' '≧' '≦' 'を含む' など）。省略時は存在のみ確認
  value?: RegExp                // 値の検証（省略時は存在のみ）
  /** number 値の範囲チェック（near 指定時: value は無視して min..max で判定） */
  range?: { min: number; max: number }
}

type SearchTurn = {
  say: string
  expect: {
    book?: string | null        // select の値（null は '' = 未確定を期待）
    conds?: CondExpect[]        // 含まれているべき条件（部分一致・順不同）
    notConds?: string[]         // 含まれていてはならないフィールド表示名
    minCount?: number           // プレビュー件数の下限
  }
}

type SearchCase = { id: string; name: string; turns: SearchTurn[] }

type CreateCase = {
  id: string
  name: string
  text?: string
  url?: string
  expect: {
    /** 確定ブック（ラベル）。'candidates' は候補提示画面を期待 */
    book?: string | 'candidates'
    /** 候補提示時に含まれるべきラベル */
    candidatesInclude?: string[]
    /** 候補提示時に選ぶラベル（その後 confirm を検証） */
    pick?: string
    /** ドラフトのフィールド検証（label の入力値が value にマッチ） */
    fields?: { label: string; value: RegExp }[]
    /** 関連先チップ（正規表現）。null 指定は「無いこと」を期待 */
    related?: RegExp | null
    /** エラーバンドの文言（部分一致） */
    errorContains?: string
  }
}

/* ── ケース定義（docs/ai-test-cases.md と1:1対応） ─────────── */

const SEARCH_CASES: SearchCase[] = [
  { id: 'S1', name: '商談: ステージ推論', turns: [
    { say: '交渉中の商談', expect: { book: 'opportunities', conds: [{ label: 'ステージ', op: '＝', value: /交渉/ }] } },
  ]},
  { id: 'S2', name: '商談: 多ターンで金額条件を追加（条件の引き継ぎ）', turns: [
    { say: '交渉中の商談', expect: { book: 'opportunities', conds: [{ label: 'ステージ' }] } },
    { say: 'そのうち金額が100万以上だけ', expect: { book: 'opportunities', conds: [{ label: 'ステージ' }, { label: '金額', op: '≧', range: { min: 1000000, max: 1000000 } }] } },
  ]},
  { id: 'S3', name: 'ブック切替: 商談→ToDo（会話で対象変更）', turns: [
    { say: '交渉中の商談', expect: { book: 'opportunities' } },
    { say: 'やっぱり今週期限の未完了ToDoを見せて', expect: { book: 'tasks', conds: [{ label: '完了', value: /false|未完了/ }, { label: '期限' }], notConds: ['ステージ'] } },
  ]},
  { id: 'S4', name: '物件: 近似値の範囲化＋地名（固有名詞ガード）', turns: [
    { say: '福岡のだいたい6000万の物件を出して', expect: { book: 'properties', conds: [
      { label: '所在地', op: 'を含む', value: /福岡/ },
      { label: '価格（円）', op: '≧', range: { min: 45000000, max: 57000000 } },
      { label: '価格（円）', op: '≦', range: { min: 63000000, max: 75000000 } },
    ] } },
  ]},
  { id: 'S5', name: '取引先: select 値の正規化（有効→active）', turns: [
    { say: '有効な取引先', expect: { book: 'accounts', conds: [{ label: 'ステータス', op: '＝', value: /有効/ }] } },
  ]},
  { id: 'S6', name: '人物: テキスト contains', turns: [
    { say: 'メールアドレスにgmailを含む人物', expect: { book: 'contacts', conds: [{ label: 'メール', value: /gmail/i }] } },
  ]},
  { id: 'S7', name: '経費: 相対日付（先月）の具体化', turns: [
    { say: '先月の経費', expect: { book: 'expenses', conds: [{ label: '日付', op: '≧' }, { label: '日付', op: '≦' }] } },
  ]},
  { id: 'S8', name: '活動履歴: 種別', turns: [
    { say: '電話の活動履歴', expect: { book: 'activities', conds: [{ label: '種別', value: /電話/ }] } },
  ]},
  { id: 'S9', name: '車両: select ステータス', turns: [
    { say: '在庫の車両', expect: { book: 'vehicles', conds: [{ label: 'ステータス', op: '＝', value: /在庫/ }] } },
  ]},
  { id: 'S10', name: '物件: 上限＋取引種別の複合', turns: [
    { say: '5000万以下の売買の物件', expect: { book: 'properties', conds: [
      { label: '価格（円）', op: '≦', range: { min: 50000000, max: 50000000 } },
      { label: '取引種別', op: '＝', value: /売買/ },
    ] } },
  ]},
  { id: 'S11', name: '単位変換: 1.5万円以上の経費', turns: [
    { say: '1.5万円以上の経費', expect: { book: 'expenses', conds: [{ label: '金額', op: '≧', range: { min: 15000, max: 15000 } }] } },
  ]},
  { id: 'S12', name: '商談: 受注（closed_won 正規化）', turns: [
    { say: '受注した商談', expect: { book: 'opportunities', conds: [{ label: 'ステージ', op: '＝', value: /受注/ }] } },
  ]},
  { id: 'S13', name: '曖昧入力: ブック未確定（聞き返し）', turns: [
    { say: '最近のやつ', expect: { book: null } },
  ]},
  { id: 'S15', name: '取引先名 join: ライフシステムの商談', turns: [
    { say: 'ライフシステムの商談', expect: { book: 'opportunities', conds: [{ label: '取引先', value: /ライフシステム/ }] } },
  ]},
  { id: 'S16', name: 'ToDo: 期限切れ', turns: [
    { say: '期限切れのToDo', expect: { book: 'tasks', conds: [{ label: '期限', op: '≦' }] } },
  ]},
]

const tomorrowJst = new Date(Date.now() + 24 * 3600 * 1000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })

const CREATE_CASES: CreateCase[] = [
  { id: 'C1', name: '名刺テキスト → 人物＋フィールド抽出', text: '株式会社グリーンテック 営業部長 佐藤一郎 ichiro.sato@greentech.co.jp 090-1111-2222',
    expect: { book: '人物', fields: [{ label: '氏名', value: /佐藤\s*一郎/ }, { label: 'メール', value: /ichiro\.sato@greentech\.co\.jp/ }] } },
  { id: 'C2', name: '会社情報 → 取引先', text: '新規取引先: 株式会社オーシャン物流。本社は神戸市。電話 078-000-1111。海運・倉庫業。',
    expect: { book: '取引先', fields: [{ label: '取引先名（会社名）', value: /オーシャン物流/ }, { label: '電話番号', value: /078/ }] } },
  { id: 'C3', name: 'ToDo＋関連先の自動セット＋相対日付（明日）', text: '明日の15時にライフシステムに書類提出',
    expect: { book: 'ToDo', related: /ライフシステム/, fields: [{ label: '期限', value: new RegExp(tomorrowJst) }] } },
  { id: 'C4', name: '活動の記録', text: '今日の午前、さくら物産の山田さんと電話で打ち合わせ。来週見積を送ることになった。',
    expect: { book: '活動履歴' } },
  { id: 'C5', name: '車両情報 → 車両', text: '仕入車両: トヨタ プリウス 2020年式 白 走行距離45000km ナンバー 品川300あ12-34',
    expect: { book: '車両', fields: [{ label: 'メーカー', value: /トヨタ/ }, { label: '車種', value: /プリウス/ }] } },
  { id: 'C6', name: '領収書 → 経費', text: '領収書: 6月10日 タクシー代 3,400円 顧客訪問の移動',
    expect: { book: '経費', fields: [{ label: '金額', value: /3400/ }] } },
  { id: 'C7', name: '物件情報 → 物件', text: '新規物件: グランメゾン博多 福岡市博多区 3LDK 売買 価格6,200万円',
    expect: { book: '物件', fields: [{ label: '物件名', value: /グランメゾン博多/ }] } },
  { id: 'C8', name: '曖昧入力 → 候補提示 or 直接確定（エラーにならない）', text: '山田工務店',
    expect: { book: 'candidates', candidatesInclude: ['取引先'], pick: '取引先',
      fields: [{ label: '取引先名（会社名）', value: /山田工務店/ }] } },
  { id: 'C10', name: '短縮リンク URL → 対処方法つきエラー', url: 'https://share.google/0LN8pLNCj7E3lWr9D', text: '',
    expect: { book: 'candidates', pick: '取引先', errorContains: '短縮リンク' } },
  { id: 'C11', name: 'ToDo＋人物言及 → 関連先（人物）', text: '田中健太さんに資料送付のタスク、期限は来週金曜',
    expect: { book: 'ToDo', related: /田中/ } },
]

/* ── DOM ヘルパー ─────────────────────────────────────────── */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function login(page: Page) {
  await page.goto('/login')
  await page.locator('input[type="email"]').first().fill(ADMIN)
  await page.locator('input[type="password"]').first().fill(PASSWORD!)
  await page.getByRole('button', { name: 'メールでログイン' }).click()
  await page.waitForURL(/dashboard/, { timeout: 30000 })
}

function modal(page: Page): Locator {
  return page.locator('div.inset-0.z-50')
}

/** 条件チップを {label, op, value} に分解（チップは span 3つ構成） */
async function readConds(page: Page): Promise<{ label: string; op: string; value: string }[]> {
  return page.locator('.bg-violet-50.border-violet-200').evaluateAll((chips) =>
    chips.map((c) => {
      const spans = Array.from(c.querySelectorAll('span'))
      return {
        label: spans[0]?.textContent?.trim() ?? '',
        op: spans[1]?.textContent?.trim() ?? '',
        value: spans[2]?.textContent?.trim() ?? '',
      }
    }))
}

function condMatches(actual: { label: string; op: string; value: string }, exp: CondExpect): boolean {
  if (actual.label !== exp.label) return false
  if (exp.op && actual.op !== exp.op) return false
  if (exp.range) {
    const n = Number(actual.value.replace(/[^\d.]/g, ''))
    if (!(Number.isFinite(n) && n >= exp.range.min && n <= exp.range.max)) return false
  } else if (exp.value && !exp.value.test(actual.value)) return false
  return true
}

type CaseResult = { id: string; name: string; ok: boolean; detail: string }

/* ── 検索ケース実行 ──────────────────────────────────────── */

async function runSearchCase(page: Page, c: SearchCase): Promise<CaseResult> {
  const problems: string[] = []
  // パネルを開き直してクリーンな会話にする
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid="quick-launcher-open"]').click()
  await modal(page).getByRole('button', { name: /AIで検索/ }).click()
  const input = page.locator('input[aria-label="AI検索の発話入力"]')
  await input.waitFor({ timeout: 10000 })

  for (const [i, turn] of c.turns.entries()) {
    await input.fill(turn.say)
    await input.press('Enter')
    // アシスタント返答（busy 解除）まで待つ
    await page.waitForFunction(() => !document.body.innerText.includes('条件を組み立て中'), undefined, { timeout: 90000 })
    await sleep(800)

    const book = await page.locator('select[aria-label="検索対象のブック"]').inputValue()
    const conds = await readConds(page)

    if (turn.expect.book !== undefined) {
      const want = turn.expect.book === null ? '' : turn.expect.book
      if (book !== want) problems.push(`turn${i + 1}: book=${book || '(未確定)'} 期待=${want || '(未確定)'}`)
    }
    for (const exp of turn.expect.conds ?? []) {
      if (!conds.some((a) => condMatches(a, exp))) {
        problems.push(`turn${i + 1}: 条件 ${exp.label}${exp.op ?? ''} が不一致/欠落 (実際: ${conds.map((x) => `${x.label}${x.op}${x.value}`).join(' | ') || 'なし'})`)
      }
    }
    for (const ng of turn.expect.notConds ?? []) {
      if (conds.some((a) => a.label === ng)) problems.push(`turn${i + 1}: 条件 ${ng} が残留`)
    }
    if (turn.expect.minCount !== undefined) {
      const t = await page.locator('text=該当').first().textContent().catch(() => '')
      const n = Number((t ?? '').replace(/[^\d]/g, ''))
      if (!(n >= turn.expect.minCount)) problems.push(`turn${i + 1}: 件数 ${n} < ${turn.expect.minCount}`)
    }
    await sleep(AI_WAIT_MS)
  }
  await page.keyboard.press('Escape')
  return { id: c.id, name: c.name, ok: problems.length === 0, detail: problems.join(' / ') }
}

/* ── 作成ケース実行 ──────────────────────────────────────── */

async function runCreateCase(page: Page, c: CreateCase): Promise<CaseResult> {
  const problems: string[] = []
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid="quick-launcher-open"]').click()
  const m = modal(page)
  await m.getByRole('button', { name: 'レコード作成' }).click()
  await m.getByRole('button', { name: /AI作成/ }).click()
  if (c.text) await m.locator('textarea').fill(c.text)
  if (c.url) await m.locator('input[type="url"]').fill(c.url)
  await m.getByRole('button', { name: /AIで解析/ }).click()

  // 確定（作成先:）か候補提示のどちらかに到達（エラーバンドの場合もある）
  await Promise.race([
    page.locator('text=作成先:').waitFor({ timeout: 120000 }),
    m.getByText('どのブックに作成しますか', { exact: false }).waitFor({ timeout: 120000 }),
    m.locator('.border-red-200').waitFor({ timeout: 120000 }),
  ]).catch(() => problems.push('応答なし（タイムアウト）'))
  await sleep(500)

  const onPick = (await m.getByText('どのブックに作成しますか', { exact: false }).count()) > 0

  if (c.expect.book === 'candidates') {
    // 候補提示を期待（ただし直接確定も成功とみなす設計のケースは pick で吸収）
    if (onPick) {
      const cands = await m.locator('.grid button').allTextContents()
      for (const need of c.expect.candidatesInclude ?? []) {
        if (!cands.some((x) => x.includes(need))) problems.push(`候補に ${need} が無い (${cands.join(',')})`)
      }
      if (c.expect.pick) {
        await m.locator('.grid button', { hasText: c.expect.pick }).first().click()
        await Promise.race([
          page.locator('text=作成先:').waitFor({ timeout: 120000 }),
          m.locator('.border-red-200').waitFor({ timeout: 120000 }),
        ]).catch(() => problems.push('候補選択後に応答なし'))
        await sleep(500)
      }
    }
    // 直接確定した場合はそのまま下の検証に流す（曖昧ケースの揺れを許容）
  } else if (c.expect.book) {
    if (onPick) {
      // 候補提示になった場合、期待ブックが候補にあれば選んで続行（推論の確信度ゆらぎを許容しつつ記録）
      const cands = await m.locator('.grid button').allTextContents()
      if (cands.some((x) => x.includes(c.expect.book!))) {
        problems.push(`(許容) 直接確定せず候補提示: ${cands.join(',')}`)
        await m.locator('.grid button', { hasText: c.expect.book }).first().click()
        await page.locator('text=作成先:').waitFor({ timeout: 120000 }).catch(() => problems.push('候補選択後に応答なし'))
        await sleep(500)
      } else {
        problems.push(`候補にも ${c.expect.book} が無い (${cands.join(',')})`)
      }
    } else {
      const chip = await m.locator('span.bg-violet-100').textContent().catch(() => '')
      if (!chip?.includes(c.expect.book)) problems.push(`作成先=${chip} 期待=${c.expect.book}`)
    }
  }

  // エラーバンド検証
  if (c.expect.errorContains) {
    const err = await m.locator('.border-red-200').first().textContent().catch(() => '')
    if (!err?.includes(c.expect.errorContains)) problems.push(`エラー文言に「${c.expect.errorContains}」が無い (実際: ${err?.slice(0, 80)})`)
  }

  // ドラフトのフィールド値検証（確認画面にいる場合）
  if (c.expect.fields && (await page.locator('text=作成先:').count()) > 0) {
    for (const f of c.expect.fields) {
      const inputEl = m.locator(`label:has-text("${f.label}")`).locator('input, textarea, select').first()
      const v = await inputEl.inputValue().catch(() => null)
      if (v == null) {
        // DraftField の構造が label 兄弟の場合に備えたフォールバック
        const v2 = await m.locator(`text=${f.label}`).locator('xpath=following::input[1] | following::textarea[1]').first().inputValue().catch(() => '')
        if (!f.value.test(v2 ?? '')) problems.push(`${f.label}="${v2}" が ${f.value} に不一致`)
      } else if (!f.value.test(v)) {
        problems.push(`${f.label}="${v}" が ${f.value} に不一致`)
      }
    }
  }

  // 関連先チップ
  if (c.expect.related !== undefined && c.expect.related !== null) {
    const rel = await m.locator('span.bg-blue-100').textContent().catch(() => '')
    if (!c.expect.related.test(rel ?? '')) problems.push(`関連先="${rel || '(未セット)'}" が ${c.expect.related} に不一致`)
  }
  if (c.expect.related === null) {
    if ((await m.locator('span.bg-blue-100').count()) > 0) problems.push('関連先が意図せずセットされた')
  }

  await page.keyboard.press('Escape')
  await sleep(AI_WAIT_MS * 2)  // classify+extract の2回ぶん
  // 許容（(許容) 接頭辞）だけなら成功扱い
  const real = problems.filter((p) => !p.startsWith('(許容)'))
  return { id: c.id, name: c.name, ok: real.length === 0, detail: problems.join(' / ') }
}

/* ── メイン ──────────────────────────────────────────────── */

async function main() {
  if (!PASSWORD) { console.error('TEST_USER_PASSWORD 未設定'); process.exit(1) }
  const only = new Set(process.argv.slice(2))
  const browser = await chromium.launch()
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ja-JP', timezoneId: 'Asia/Tokyo', baseURL: BASE_URL })).newPage()
  await login(page)

  const results: CaseResult[] = []
  for (const c of SEARCH_CASES) {
    if (only.size && !only.has(c.id)) continue
    try { results.push(await runSearchCase(page, c)) }
    catch (e) { results.push({ id: c.id, name: c.name, ok: false, detail: `例外: ${(e as Error).message.split('\n')[0]}` }) }
    console.log(`${results.at(-1)!.ok ? '✓' : '✗'} ${c.id} ${c.name}${results.at(-1)!.detail ? ` — ${results.at(-1)!.detail}` : ''}`)
  }
  for (const c of CREATE_CASES) {
    if (only.size && !only.has(c.id)) continue
    try { results.push(await runCreateCase(page, c)) }
    catch (e) { results.push({ id: c.id, name: c.name, ok: false, detail: `例外: ${(e as Error).message.split('\n')[0]}` }) }
    console.log(`${results.at(-1)!.ok ? '✓' : '✗'} ${c.id} ${c.name}${results.at(-1)!.detail ? ` — ${results.at(-1)!.detail}` : ''}`)
  }

  await browser.close()
  const ng = results.filter((r) => !r.ok)
  console.log(`\n結果: ${results.length - ng.length}/${results.length} pass`)
  if (ng.length) { console.log('失敗:'); ng.forEach((r) => console.log(`  ${r.id}: ${r.detail}`)) }
  process.exit(ng.length ? 1 : 0)
}

main()
