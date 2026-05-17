/**
 * 車検満了 30 日前リマインダー：
 *   customer_vehicles.inspection_due_date が「今日〜30日後」の車両に対し、
 *   未完了の同種 ToDo が存在しなければ自動で「車検案内: <ナンバー> 期限 <日付>」
 *   を作成する。
 *
 * junction で:
 *   - account（顧客）
 *   - customer-vehicle（顧客車両）
 *   に紐付け、整備の親レコードからナビゲートできるようにする。
 *
 * 想定運用:
 *   - Vercel Cron Jobs から daily で叩く
 *   - or 手動で `npx tsx scripts/check-inspection-reminders.ts` を回す
 *
 * 冪等性:
 *   - 同じ車両に対する未完了 ToDo を検出（title に「車検案内」と plate_number を含む）
 *   - 既にあれば作成スキップ
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

const DAYS_AHEAD = Number(process.env.INSPECTION_REMINDER_DAYS_AHEAD ?? '30')

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}
function dateOffsetIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

async function main() {
  const host = (process.env.DATABASE_URL ?? '').match(/@([^/]+)\//)?.[1] ?? '?'
  console.log(`📍 DB: ${host}`)
  const today = todayIso()
  const limit = dateOffsetIso(DAYS_AHEAD)
  console.log(`   検査対象期間: ${today} 〜 ${limit} (${DAYS_AHEAD} 日後まで)`)

  // 期限が範囲内の車両
  const dueCars = await sql`
    SELECT
      cv.id, cv.plate_number, cv.car_name, cv.car_model, cv.account_id, cv.inspection_due_date::text AS due,
      a.name AS account_name
    FROM customer_vehicles cv
    LEFT JOIN accounts a ON a.id = cv.account_id
    WHERE cv.inspection_due_date IS NOT NULL
      AND cv.inspection_due_date >= ${today}
      AND cv.inspection_due_date <= ${limit}
    ORDER BY cv.inspection_due_date ASC
  `
  console.log(`   対象車両: ${dueCars.length} 台`)

  let created = 0, skipped = 0

  for (const v of dueCars) {
    const titleMarker = `車検案内: ${v.plate_number ?? '—'}`

    // 既存の未完了 ToDo (同マーカー含む) があればスキップ
    const existing = await sql`
      SELECT t.id FROM tasks t
      INNER JOIN task_related_records trr ON trr.task_id = t.id
      WHERE t.done = FALSE
        AND t.title LIKE ${'%' + titleMarker + '%'}
        AND trr.related_object_api = 'customer-vehicle'
        AND trr.related_record_id = ${v.id}
      LIMIT 1
    `
    if (existing.length > 0) {
      console.log(`  ${v.plate_number ?? '—'}: ✓ 既存 ToDo あり (スキップ)`)
      skipped++
      continue
    }

    // 期限を due 日に設定（運用余裕 1 日前）
    const dueDate = v.due  // string YYYY-MM-DD
    const title = `${titleMarker} 期限 ${dueDate}`
    const body  = `${v.car_name ?? ''} ${v.car_model ?? ''} の車検が ${dueDate} に満了します。早めにお客様（${v.account_name ?? '—'}）に連絡してください。`

    const [t] = await sql`
      INSERT INTO tasks (title, due_date, done, priority)
      VALUES (${title}, ${dueDate}, FALSE, 'high')
      RETURNING id
    `

    // junction: customer-vehicle + account
    const rels: Array<{ task_id: string; related_object_api: string; related_record_id: string }> = [
      { task_id: t.id as string, related_object_api: 'customer-vehicle', related_record_id: v.id as string },
    ]
    if (v.account_id) {
      rels.push({ task_id: t.id as string, related_object_api: 'account', related_record_id: v.account_id as string })
    }
    for (const r of rels) {
      await sql`
        INSERT INTO task_related_records (task_id, related_object_api, related_record_id)
        VALUES (${r.task_id}, ${r.related_object_api}, ${r.related_record_id})
        ON CONFLICT DO NOTHING
      `
    }

    void body  // body は activities 側用、tasks には title のみ保持
    created++
    console.log(`  ${v.plate_number ?? '—'}: ＋ ToDo 作成 (期限 ${dueDate})`)
  }

  console.log()
  console.log(`✅ 完了: 新規 ${created} 件 / 既存スキップ ${skipped} 件`)
}

main().then(() => process.exit(0)).catch((e) => { console.error('FAIL:', e); process.exit(1) })
