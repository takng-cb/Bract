/**
 * GET /api/search/records?objectType=<api>&q=<検索語>&exclude=id1,id2&ids=id1,id2&limit=30
 *
 * レコード検索エンドポイント（関連レコード Picker / 関係性追加 UI 共用）。
 * - objectType ごとにレコード名を部分一致検索して返す（q 空なら最近更新順）。
 * - ids= 指定時はその ID 群のレコードを返す（既選択のラベル解決用）。
 * - 対応 objectType:
 *     accounts/account, contacts/contact, opportunities/opportunity,
 *     maintenance(整備), customer-vehicle(顧客車両), その他=カスタム（custom_records）
 * - RBAC: 対象ブックの Read 権限が無い場合は 403（ADR-0023）。
 */
import { db } from '@/lib/db'
import {
  accounts, contacts, opportunities, object_definitions, custom_records,
  maintenance_records, customer_vehicles,
} from '@/lib/schema'
import { ilike, notInArray, inArray, and, or, eq, desc, sql, type SQL } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { canDo } from '@/lib/permissions'
import { maintenanceDisplayName } from '@/industries/auto-body/lib/maintenanceDisplay'

const DEFAULT_LIMIT = 30
const MAX_LIMIT = 50

type Result = { id: string; label: string; sub?: string }

/** objectType（単複/別名）→ 正規化キー */
function normalize(objectType: string): string {
  const map: Record<string, string> = {
    account: 'accounts', accounts: 'accounts',
    contact: 'contacts', contacts: 'contacts',
    opportunity: 'opportunities', opportunities: 'opportunities',
    maintenance: 'maintenance', 'customer-vehicle': 'customer-vehicle',
  }
  return map[objectType] ?? objectType
}

/** RBAC 判定に使う book_api */
function bookFor(normalized: string): string {
  if (normalized === 'maintenance') return 'maintenance_records'
  if (normalized === 'customer-vehicle') return 'customer_vehicles'
  return normalized
}

export async function GET(req: NextRequest) {
  // 認証確認
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const objectType = normalize(searchParams.get('objectType') ?? '')
  const q          = (searchParams.get('q') ?? '').trim()
  const excludeIds = (searchParams.get('exclude') ?? '').split(',').filter(Boolean)
  const ids        = (searchParams.get('ids') ?? '').split(',').filter(Boolean)
  const limit      = Math.min(Number(searchParams.get('limit') ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, MAX_LIMIT)

  if (!objectType) return NextResponse.json({ error: 'objectType is required' }, { status: 400 })

  // RBAC: Read 権限（ADR-0023）
  if (!(await canDo(bookFor(objectType), 'read'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const pattern = `%${q}%`
  let results: Result[] = []

  try {
    switch (objectType) {
      case 'accounts': {
        const conds: (SQL | undefined)[] = [
          q ? ilike(accounts.name, pattern) : undefined,
          excludeIds.length > 0 ? notInArray(accounts.id, excludeIds) : undefined,
          ids.length > 0 ? inArray(accounts.id, ids) : undefined,
        ]
        const rows = await db
          .select({ id: accounts.id, name: accounts.name, industry: accounts.industry })
          .from(accounts)
          .where(and(...conds.filter(Boolean) as SQL[]))
          .orderBy(desc(accounts.updated_at))
          .limit(limit)
        results = rows.map((r) => ({ id: r.id, label: r.name, sub: r.industry ?? undefined }))
        break
      }

      case 'contacts': {
        const conds: (SQL | undefined)[] = [
          q ? or(ilike(contacts.full_name, pattern), ilike(contacts.email, pattern)) : undefined,
          excludeIds.length > 0 ? notInArray(contacts.id, excludeIds) : undefined,
          ids.length > 0 ? inArray(contacts.id, ids) : undefined,
        ]
        const rows = await db
          .select({ id: contacts.id, full_name: contacts.full_name, title: contacts.title })
          .from(contacts)
          .where(and(...conds.filter(Boolean) as SQL[]))
          .orderBy(desc(contacts.updated_at))
          .limit(limit)
        results = rows.map((r) => ({ id: r.id, label: r.full_name, sub: r.title ?? undefined }))
        break
      }

      case 'opportunities': {
        const conds: (SQL | undefined)[] = [
          q ? ilike(opportunities.name, pattern) : undefined,
          excludeIds.length > 0 ? notInArray(opportunities.id, excludeIds) : undefined,
          ids.length > 0 ? inArray(opportunities.id, ids) : undefined,
        ]
        const rows = await db
          .select({ id: opportunities.id, name: opportunities.name, stage: opportunities.stage })
          .from(opportunities)
          .where(and(...conds.filter(Boolean) as SQL[]))
          .orderBy(desc(opportunities.updated_at))
          .limit(limit)
        results = rows.map((r) => ({ id: r.id, label: r.name, sub: r.stage ?? undefined }))
        break
      }

      case 'maintenance': {
        // ラベルは顧客/車両を含む表示名（relatedRecordsPicker と同等）
        const conds: (SQL | undefined)[] = [
          q ? ilike(maintenance_records.maintenance_no, pattern) : undefined,
          excludeIds.length > 0 ? notInArray(maintenance_records.id, excludeIds) : undefined,
          ids.length > 0 ? inArray(maintenance_records.id, ids) : undefined,
        ]
        const rows = await db
          .select({
            id: maintenance_records.id,
            status: maintenance_records.status,
            intake_date: maintenance_records.intake_date,
            account: { id: accounts.id, name: accounts.name },
            contact: { id: contacts.id, full_name: contacts.full_name },
            vehicle: { id: customer_vehicles.id, car_name: customer_vehicles.car_name, car_model: customer_vehicles.car_model },
          })
          .from(maintenance_records)
          .leftJoin(accounts, eq(maintenance_records.account_id, accounts.id))
          .leftJoin(contacts, eq(maintenance_records.contact_id, contacts.id))
          .leftJoin(customer_vehicles, eq(maintenance_records.customer_vehicle_id, customer_vehicles.id))
          .where(and(...conds.filter(Boolean) as SQL[]))
          .orderBy(desc(maintenance_records.created_at))
          .limit(limit)
        results = rows.map((m) => {
          const acc = m.account?.id ? m.account : null
          const con = m.contact?.id ? m.contact : null
          const v   = m.vehicle?.id ? m.vehicle : null
          const name = maintenanceDisplayName({ intake_date: m.intake_date }, acc, con, v)
          return { id: m.id, label: `${name} [${m.status}]` }
        })
        break
      }

      case 'customer-vehicle': {
        const conds: (SQL | undefined)[] = [
          q ? or(
            ilike(customer_vehicles.plate_number, pattern),
            ilike(customer_vehicles.car_name, pattern),
            ilike(customer_vehicles.car_model, pattern),
          ) : undefined,
          excludeIds.length > 0 ? notInArray(customer_vehicles.id, excludeIds) : undefined,
          ids.length > 0 ? inArray(customer_vehicles.id, ids) : undefined,
        ]
        const rows = await db
          .select({
            id: customer_vehicles.id,
            plate_number: customer_vehicles.plate_number,
            car_model: customer_vehicles.car_model,
            account_name: accounts.name,
          })
          .from(customer_vehicles)
          .leftJoin(accounts, eq(customer_vehicles.account_id, accounts.id))
          .where(and(...conds.filter(Boolean) as SQL[]))
          .orderBy(desc(customer_vehicles.updated_at))
          .limit(limit)
        results = rows.map((v) => ({
          id: v.id,
          label: [v.plate_number ?? '—', v.car_model, v.account_name].filter(Boolean).join(' / '),
        }))
        break
      }

      default: {
        // カスタムオブジェクト：custom_records.data の name/title を DB 側でフィルタ
        const objRows = await db
          .select({ id: object_definitions.id, label: object_definitions.label })
          .from(object_definitions)
          .where(eq(object_definitions.api_name, objectType))
          .limit(1)
        if (objRows.length === 0) {
          return NextResponse.json({ error: 'Unknown objectType' }, { status: 400 })
        }
        const objectId = objRows[0].id
        const conds: (SQL | undefined)[] = [
          eq(custom_records.object_id, objectId),
          q ? sql`((${custom_records.data}->>'name') ILIKE ${pattern} OR (${custom_records.data}->>'title') ILIKE ${pattern})` : undefined,
          excludeIds.length > 0 ? notInArray(custom_records.id, excludeIds) : undefined,
          ids.length > 0 ? inArray(custom_records.id, ids) : undefined,
        ]
        const rows = await db
          .select({ id: custom_records.id, data: custom_records.data })
          .from(custom_records)
          .where(and(...conds.filter(Boolean) as SQL[]))
          .orderBy(desc(custom_records.updated_at))
          .limit(limit)
        results = rows.map((r) => {
          const d = (r.data ?? {}) as Record<string, unknown>
          const label = (typeof d.name === 'string' && d.name) || (typeof d.title === 'string' && d.title) || `${objRows[0].label} #${r.id.slice(0, 8)}`
          return { id: r.id, label: String(label), sub: typeof d.status === 'string' ? d.status : undefined }
        })
        break
      }
    }

    return NextResponse.json(results)
  } catch (e) {
    console.error('[search/records]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
