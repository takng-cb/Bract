/**
 * 既存の maintenance_records に対して、不足している
 *   - 行アイテム (maintenance_line_items)
 *   - 諸費用 (maintenance_fees)
 *   - 入金 (maintenance_payments)
 * を補完するスクリプト。
 *
 * メイン seed (scripts/seed-maintenance.ts) は plan ベースで投入するが、
 * 予約・キャンセル などのステータスは 0 件のままなので、UI で各サブタブが
 * 空に見えてしまう。本スクリプトは「既に空のサブタブ」だけを補完する
 * （既にデータがあるサブタブには触らない）。
 *
 * status / intake_category に応じてリアルなパターンで投入:
 *   - 予約        : 見積行（work_status='未完了'）、諸費用 0、入金 0
 *   - 受付        : 点検診断行（一部完了）、諸費用 0、入金 0
 *   - 作業中      : 既存行に追加せず、諸費用補完のみ、入金 0
 *   - 納車待ち    : 既存行/諸費用に追加せず、入金 0 のまま OK（請求残額確認用）
 *   - 完了        : 既存行に追加せず、諸費用補完のみ
 *   - キャンセル  : 中断した行を 1-2 件（is_excluded=true）、諸費用 0、入金 0
 *
 * 安全性:
 *   - SUPPLEMENT_ONLY モード: 子件数が 0 のサブタブだけ補完する（デフォルト）
 *   - 既存のデータには触らない
 *
 * 実行:
 *   # auto-body Neon
 *   DATABASE_URL="$(grep '^DATABASE_URL' .claude/worktrees/auto-body-lv/.env.local | cut -d= -f2-)" \
 *     npx tsx scripts/seed-maintenance-children-supplement.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

const TODAY = new Date('2026-05-16')
function dateOffset(daysFromToday: number): string {
  const d = new Date(TODAY)
  d.setDate(d.getDate() + daysFromToday)
  return d.toISOString().slice(0, 10)
}

type MaintRow = {
  id: string
  maintenance_no: string
  status: string
  intake_category: string | null
  intake_date: string | null
  owner_id: string | null
}

type LineSeed = {
  work_category: string
  item_name: string
  hours?: number
  labor_amount?: number
  parts_qty?: number
  parts_unit?: string
  parts_unit_price?: number
  cost_unit_price?: number
  note?: string
  state?: string
  is_excluded?: boolean
  work_status?: '未完了' | '完了'
}
type FeeSeed = { category: '課税' | '非課税'; item_name: string; amount: number; cost_amount?: number }
type PaySeed = { method: string; amount: number; daysFromIntake: number; memo?: string }

/** status × category ごとの補完テンプレート */
function templates(m: MaintRow): { lines: LineSeed[]; fees: FeeSeed[]; payments: PaySeed[] } {
  const cat = m.intake_category ?? ''
  switch (m.status) {
    case '予約': {
      const baseLines: LineSeed[] = cat === '車検' ? [
        { work_category: '車検',   item_name: '24ヶ月点検整備（見積）', hours: 2.0, labor_amount: 20000, work_status: '未完了' },
        { work_category: '消耗品', item_name: 'エンジンオイル交換（予定）', hours: 0.3, labor_amount: 3000, parts_qty: 4, parts_unit: 'L', parts_unit_price: 1200, cost_unit_price: 700, work_status: '未完了' },
      ] : cat === '点検' ? [
        { work_category: '点検',   item_name: '12ヶ月点検整備（見積）', hours: 1.5, labor_amount: 15000, work_status: '未完了' },
        { work_category: '消耗品', item_name: 'オイル交換予定',          hours: 0.3, labor_amount: 3000, parts_qty: 4, parts_unit: 'L', parts_unit_price: 1200, cost_unit_price: 700, work_status: '未完了' },
      ] : [
        { work_category: '点検',   item_name: '一般点検（見積）', hours: 0.5, labor_amount: 5000, work_status: '未完了' },
        { work_category: '消耗品', item_name: 'オイル交換',       hours: 0.3, labor_amount: 3000, parts_qty: 4, parts_unit: 'L', parts_unit_price: 1200, cost_unit_price: 700, work_status: '未完了' },
      ]
      return { lines: baseLines, fees: [], payments: [] }
    }

    case '受付': {
      // 受付直後 = 点検診断のみ完了、本作業は未着手
      return {
        lines: [
          { work_category: '点検', item_name: '受入時 点検診断', hours: 0.5, labor_amount: 5000, work_status: '完了', note: '入庫時のヒアリング＋目視点検' },
          { work_category: '見積', item_name: '見積提示予定',     hours: 0.0, labor_amount: 0,     work_status: '未完了' },
        ],
        fees: [],
        payments: [],
      }
    }

    case '作業中': {
      // 既存行はあるはず → 諸費用 を補完（板金修理ならレンタカー、車検は既に入ってる）
      const fees: FeeSeed[] = cat === '板金修理'
        ? [
            { category: '課税', item_name: 'レンタカー代行（3日）', amount: 15000, cost_amount: 7000 },
            { category: '課税', item_name: '出張引取（往復15km）', amount: 4000,  cost_amount: 1500 },
          ]
        : []
      return { lines: [], fees, payments: [] }
    }

    case '納車待ち': {
      // 通常は入金 0 のまま (納車時清算)。テストデータ可視化のため、前金で1件入れる
      const days = m.intake_date ? 0 : 0  // 入庫日基準で +1 日後の前金
      return {
        lines: [],
        fees: [],
        payments: [{ method: '銀行振込', amount: 30000, daysFromIntake: 1, memo: '前金（納車前 一部入金）' }],
      }
    }

    case '完了': {
      // 一般整備 で諸費用が空のケースを補完
      const fees: FeeSeed[] = cat === '一般整備' || cat === '12ヶ月点検'
        ? [{ category: '課税', item_name: '出張引取料', amount: 5000, cost_amount: 2000 }]
        : []
      // 入金が無いものに最終入金を追加するパターン
      return { lines: [], fees, payments: [] }
    }

    case 'キャンセル': {
      return {
        lines: [
          { work_category: '点検', item_name: '受入時 点検診断（キャンセル前）', hours: 0.3, labor_amount: 3000, is_excluded: true, work_status: '完了', note: 'キャンセルのため除外' },
        ],
        fees: [],
        payments: [],
      }
    }

    default:
      return { lines: [], fees: [], payments: [] }
  }
}

async function nextSortOrder(table: 'maintenance_line_items' | 'maintenance_fees', mid: string): Promise<number> {
  const rows = table === 'maintenance_line_items'
    ? await sql`SELECT COALESCE(MAX(sort_order), -1)::int AS s FROM maintenance_line_items WHERE maintenance_id=${mid}`
    : await sql`SELECT COALESCE(MAX(sort_order), -1)::int AS s FROM maintenance_fees       WHERE maintenance_id=${mid}`
  return Number(rows[0].s) + 1
}

async function main() {
  const host = (process.env.DATABASE_URL ?? '').match(/@([^/]+)\//)?.[1] ?? '?'
  console.log(`📍 DB: ${host}`)
  console.log()

  const records = await sql`
    SELECT id, maintenance_no, status, intake_category, intake_date::text AS intake_date, owner_id
    FROM maintenance_records ORDER BY intake_date DESC
  ` as unknown as MaintRow[]

  let totalLines = 0, totalFees = 0, totalPays = 0

  for (const m of records) {
    const childCounts = await sql`
      SELECT
        (SELECT count(*)::int FROM maintenance_line_items WHERE maintenance_id=${m.id}) AS lines,
        (SELECT count(*)::int FROM maintenance_fees       WHERE maintenance_id=${m.id}) AS fees,
        (SELECT count(*)::int FROM maintenance_payments   WHERE maintenance_id=${m.id}) AS pays
    `
    const c = childCounts[0] as { lines: number; fees: number; pays: number }
    const tmpl = templates(m)

    const addLines = c.lines === 0 ? tmpl.lines : []
    const addFees  = c.fees  === 0 ? tmpl.fees  : []
    const addPays  = c.pays  === 0 ? tmpl.payments : []
    if (addLines.length === 0 && addFees.length === 0 && addPays.length === 0) {
      console.log(`  ${m.maintenance_no} [${m.status}/${m.intake_category}] — 補完不要 (現状 行=${c.lines} 諸=${c.fees} 入=${c.pays})`)
      continue
    }

    console.log(`  ${m.maintenance_no} [${m.status}/${m.intake_category}] — 補完: 行+${addLines.length} 諸+${addFees.length} 入+${addPays.length}`)

    if (addLines.length > 0) {
      const startSort = await nextSortOrder('maintenance_line_items', m.id)
      for (let i = 0; i < addLines.length; i++) {
        const l = addLines[i]
        await sql`
          INSERT INTO maintenance_line_items (
            maintenance_id, sort_order, work_category, item_name,
            hours, labor_amount, parts_qty, parts_unit, parts_unit_price, cost_unit_price,
            note, state, is_excluded, work_status
          ) VALUES (
            ${m.id}, ${startSort + i}, ${l.work_category}, ${l.item_name},
            ${l.hours ?? null}, ${l.labor_amount ?? null},
            ${l.parts_qty ?? null}, ${l.parts_unit ?? null}, ${l.parts_unit_price ?? null}, ${l.cost_unit_price ?? null},
            ${l.note ?? null}, ${l.state ?? null}, ${l.is_excluded ?? false}, ${l.work_status ?? '未完了'}
          )
        `
        totalLines++
      }
    }

    if (addFees.length > 0) {
      const startSort = await nextSortOrder('maintenance_fees', m.id)
      for (let i = 0; i < addFees.length; i++) {
        const f = addFees[i]
        await sql`
          INSERT INTO maintenance_fees (maintenance_id, sort_order, category, item_name, amount, cost_amount)
          VALUES (${m.id}, ${startSort + i}, ${f.category}, ${f.item_name}, ${f.amount}, ${f.cost_amount ?? null})
        `
        totalFees++
      }
    }

    if (addPays.length > 0) {
      const baseDate = m.intake_date ?? dateOffset(0)
      for (const p of addPays) {
        // intake_date + daysFromIntake
        const d = new Date(baseDate + 'T00:00:00')
        d.setDate(d.getDate() + p.daysFromIntake)
        const payDate = d.toISOString().slice(0, 10)
        await sql`
          INSERT INTO maintenance_payments (maintenance_id, payment_method, memo, amount, payment_date, owner_id, branch_id)
          VALUES (${m.id}, ${p.method}, ${p.memo ?? null}, ${p.amount}, ${payDate}, ${m.owner_id}, '本店')
        `
        totalPays++
      }
    }
  }

  console.log()
  console.log(`✅ 完了: 行+${totalLines}, 諸費用+${totalFees}, 入金+${totalPays}`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
