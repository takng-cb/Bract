/**
 * 組み込みオブジェクト定義を book_definitions / book_fields に投入する
 * 実行: npx tsx scripts/seed-metadata.ts
 */
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as dotenv from 'dotenv'
import { resolve } from 'path'
import * as schema from '../src/lib/schema'
import { eq } from 'drizzle-orm'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const sql = neon(process.env.DATABASE_URL!)
const db  = drizzle(sql, { schema })

// 組み込みオブジェクト定義
const BUILTIN_OBJECTS = [
  { api_name: 'accounts',      label: '取引先',    label_plural: '取引先一覧',    icon: '🏢', sort_order: 1 },
  { api_name: 'contacts',      label: '人物',      label_plural: '人物一覧',      icon: '👤', sort_order: 2 },
  { api_name: 'opportunities', label: '商談',      label_plural: '商談一覧',      icon: '💼', sort_order: 3 },
  { api_name: 'activities',    label: '活動履歴',  label_plural: '活動履歴一覧',  icon: '📋', sort_order: 4 },
  { api_name: 'tasks',         label: 'ToDo',      label_plural: 'ToDo一覧',      icon: '✅', sort_order: 5 },
  { api_name: 'expenses',      label: '経費',      label_plural: '経費一覧',      icon: '💰', sort_order: 6 },
  { api_name: 'properties',    label: '物件・商品', label_plural: '物件・商品一覧', icon: '🏠', sort_order: 7 },
  // 業種オブジェクト（typed テーブル＋メタデータ。is_builtin=true で /admin/objects に表示）
  { api_name: 'vehicles',            label: '車両',     label_plural: '車両一覧',     icon: '🚗',    sort_order: 10 },
  { api_name: 'parts',               label: '部品',     label_plural: '部品マスタ',   icon: '🪛',    sort_order: 11 },
  { api_name: 'maintenance_records', label: '整備',     label_plural: '整備一覧',     icon: '🔧',    sort_order: 12 },
  { api_name: 'customer_vehicles',   label: '顧客車両', label_plural: '顧客車両一覧', icon: '🚙',    sort_order: 13 },
  { api_name: 'assignments',         label: '案件',     label_plural: '案件一覧',     icon: '📦',    sort_order: 14 },
  { api_name: 'staff',               label: 'スタッフ', label_plural: 'スタッフ一覧', icon: '🧑‍💼', sort_order: 15 },
] as const

async function main() {
  console.log('🌱 メタデータ初期データを投入中...\n')

  for (const obj of BUILTIN_OBJECTS) {
    // 既に存在する場合はスキップ
    const existing = await db.select({ id: schema.book_definitions.id })
      .from(schema.book_definitions)
      .where(eq(schema.book_definitions.api_name, obj.api_name))
      .then((r) => r[0] ?? null)

    if (existing) {
      console.log(`  ⏭️  スキップ: ${obj.api_name} (既存)`)
      continue
    }

    await db.insert(schema.book_definitions).values({
      api_name:     obj.api_name,
      label:        obj.label,
      label_plural: obj.label_plural,
      icon:         obj.icon,
      is_builtin:   true,
      nav_enabled:  true,
      sort_order:   obj.sort_order,
    })
    console.log(`  ✅ ${obj.api_name}`)
  }

  const total = await db.select({ id: schema.book_definitions.id })
    .from(schema.book_definitions)
    .then((r) => r.length)
  console.log(`\n✅ 完了 — book_definitions: 計 ${total} 件`)
}

main().catch((e) => { console.error('❌', e); process.exit(1) })
