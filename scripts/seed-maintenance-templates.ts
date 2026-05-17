/**
 * 整備パッケージ（テンプレート）の代表セットを投入する seed。
 *
 * 投入対象（冪等：同名テンプレ無いときだけ INSERT）:
 *   1. 車検基本パック（普通車）
 *   2. オイル交換セット
 *   3. 12ヶ月点検 基本セット
 *   4. 板金 小傷修理セット
 *   5. 新車納車整備セット
 *
 * 実行:
 *   # auto-body Neon
 *   DATABASE_URL="$(grep '^DATABASE_URL' .claude/worktrees/auto-body-lv/.env.local | cut -d= -f2-)" \
 *     npx tsx scripts/seed-maintenance-templates.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

type LineSeed = {
  work_category?: string
  item_name: string
  hours?: number
  labor_amount?: number
  parts_qty?: number
  parts_unit?: string
  parts_unit_price?: number
  cost_unit_price?: number
  note?: string
}
type FeeSeed = { category: '課税' | '非課税'; item_name: string; amount: number; cost_amount?: number }

type TemplatePlan = {
  name: string
  description?: string
  category?: string
  sort_order: number
  lines: LineSeed[]
  fees: FeeSeed[]
}

const PLANS: TemplatePlan[] = [
  {
    name: '車検基本パック（普通車）',
    description: '24ヶ月点検 + ブレーキ清掃 + オイル/エレメント交換 + 法定諸費用',
    category: '車検',
    sort_order: 10,
    lines: [
      { work_category: '車検',   item_name: '24ヶ月点検整備',     hours: 2.0, labor_amount: 20000 },
      { work_category: '車検',   item_name: 'ブレーキ分解清掃',   hours: 1.5, labor_amount: 15000 },
      { work_category: '消耗品', item_name: 'エンジンオイル交換', hours: 0.3, labor_amount: 3000, parts_qty: 4, parts_unit: 'L', parts_unit_price: 1200, cost_unit_price: 700 },
      { work_category: '消耗品', item_name: 'オイルエレメント',                                  parts_qty: 1, parts_unit: '個', parts_unit_price: 1800, cost_unit_price: 1000 },
      { work_category: '消耗品', item_name: 'ワイパーゴム交換',                                  parts_qty: 2, parts_unit: '本', parts_unit_price: 800,  cost_unit_price: 400 },
    ],
    fees: [
      { category: '非課税', item_name: '自賠責保険（24ヶ月）', amount: 17650, cost_amount: 17650 },
      { category: '非課税', item_name: '自動車重量税',         amount: 24600, cost_amount: 24600 },
      { category: '非課税', item_name: '印紙代',               amount: 1800,  cost_amount: 1800 },
      { category: '課税',   item_name: '検査代行料',           amount: 8000,  cost_amount: 0 },
    ],
  },
  {
    name: 'オイル交換セット',
    description: 'エンジンオイル + オイルエレメント',
    category: '一般整備',
    sort_order: 20,
    lines: [
      { work_category: '消耗品', item_name: 'エンジンオイル交換', hours: 0.3, labor_amount: 3000, parts_qty: 4, parts_unit: 'L', parts_unit_price: 1200, cost_unit_price: 700 },
      { work_category: '消耗品', item_name: 'オイルエレメント',                                  parts_qty: 1, parts_unit: '個', parts_unit_price: 1800, cost_unit_price: 1000 },
    ],
    fees: [],
  },
  {
    name: '12ヶ月点検 基本セット',
    description: '12ヶ月法定点検 + 基本消耗品',
    category: '点検',
    sort_order: 30,
    lines: [
      { work_category: '点検',   item_name: '12ヶ月点検整備',     hours: 1.5, labor_amount: 15000 },
      { work_category: '消耗品', item_name: 'エンジンオイル交換', hours: 0.3, labor_amount: 3000, parts_qty: 4, parts_unit: 'L', parts_unit_price: 1200, cost_unit_price: 700 },
      { work_category: '消耗品', item_name: 'エアコンフィルター',                                parts_qty: 1, parts_unit: '個', parts_unit_price: 3500, cost_unit_price: 1800 },
    ],
    fees: [],
  },
  {
    name: '板金 小傷修理セット',
    description: 'バンパー脱着 + 板金 + 塗装 1 パネル',
    category: '板金修理',
    sort_order: 40,
    lines: [
      { work_category: '板金', item_name: 'バンパー脱着',     hours: 1.0, labor_amount: 10000 },
      { work_category: '板金', item_name: '板金作業（1パネル）', hours: 3.0, labor_amount: 36000 },
      { work_category: '塗装', item_name: '塗装（1パネル）',  hours: 4.0, labor_amount: 48000 },
      { work_category: '部品', item_name: '塗料・パテ類',                                  parts_qty: 1, parts_unit: '式', parts_unit_price: 12000, cost_unit_price: 6500 },
    ],
    fees: [
      { category: '課税', item_name: '出張引取（往復20km）', amount: 5000, cost_amount: 2000 },
    ],
  },
  {
    name: '新車納車整備セット',
    description: '納車前点検 + コーティング + ドラレコ取付',
    category: '新車納車整備',
    sort_order: 50,
    lines: [
      { work_category: '納車整備',   item_name: '新車納車前点検',     hours: 1.0, labor_amount: 10000 },
      { work_category: 'コーティング', item_name: 'ガラスコーティング施工', hours: 4.0, labor_amount: 30000, parts_qty: 1, parts_unit: '式', parts_unit_price: 25000, cost_unit_price: 12000 },
      { work_category: '取付',       item_name: 'ドライブレコーダー前後取付', hours: 1.5, labor_amount: 12000, parts_qty: 1, parts_unit: '台', parts_unit_price: 28000, cost_unit_price: 18000 },
    ],
    fees: [
      { category: '課税', item_name: '納車陸送費', amount: 8000, cost_amount: 5000 },
    ],
  },
]

async function main() {
  const host = (process.env.DATABASE_URL ?? '').match(/@([^/]+)\//)?.[1] ?? '?'
  console.log(`📍 DB: ${host}`)

  let createdTemplates = 0, createdLines = 0, createdFees = 0

  for (const p of PLANS) {
    // 冪等: 同名テンプレが既にあればスキップ
    const existing = await sql`SELECT id FROM maintenance_templates WHERE name = ${p.name} LIMIT 1`
    if (existing.length > 0) {
      console.log(`  ${p.name}: ✓ 既存`)
      continue
    }

    const [t] = await sql`
      INSERT INTO maintenance_templates (name, description, category, is_active, sort_order)
      VALUES (${p.name}, ${p.description ?? null}, ${p.category ?? null}, true, ${p.sort_order})
      RETURNING id
    `
    createdTemplates++
    console.log(`  ${p.name}: 新規作成 (id=${(t.id as string).slice(0, 8)})`)

    for (let i = 0; i < p.lines.length; i++) {
      const l = p.lines[i]
      await sql`
        INSERT INTO maintenance_template_lines (
          template_id, sort_order, work_category, item_name,
          hours, labor_amount, parts_qty, parts_unit, parts_unit_price, cost_unit_price, note
        ) VALUES (
          ${t.id}, ${i}, ${l.work_category ?? null}, ${l.item_name},
          ${l.hours ?? null}, ${l.labor_amount ?? null},
          ${l.parts_qty ?? null}, ${l.parts_unit ?? null}, ${l.parts_unit_price ?? null}, ${l.cost_unit_price ?? null},
          ${l.note ?? null}
        )
      `
      createdLines++
    }

    for (let i = 0; i < p.fees.length; i++) {
      const f = p.fees[i]
      await sql`
        INSERT INTO maintenance_template_fees (template_id, sort_order, category, item_name, amount, cost_amount)
        VALUES (${t.id}, ${i}, ${f.category}, ${f.item_name}, ${f.amount}, ${f.cost_amount ?? null})
      `
      createdFees++
    }
  }

  console.log()
  console.log(`✅ 完了: テンプレ ${createdTemplates} 件 / 行 ${createdLines} 件 / 諸費用 ${createdFees} 件`)
}

main().then(() => process.exit(0)).catch((e) => { console.error('FAIL:', e); process.exit(1) })
