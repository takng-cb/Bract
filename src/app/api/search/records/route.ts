/**
 * GET /api/search/records?objectType=opportunities&q=テスト&exclude=id1,id2
 *
 * 関係性追加UI用のレコード検索エンドポイント。
 * objectType 別にレコード名を前方一致検索して返す。
 *
 * 組み込みオブジェクト（accounts / contacts / opportunities）は専用テーブルを参照。
 * それ以外はカスタムオブジェクト（custom_records + object_definitions）を参照。
 */

import { db } from '@/lib/db'
import { accounts, contacts, opportunities, object_definitions, custom_records } from '@/lib/schema'
import { ilike, notInArray, and, eq, inArray } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const MAX_RESULTS = 10

export async function GET(req: NextRequest) {
  // 認証確認
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const objectType = searchParams.get('objectType') ?? ''
  const q          = searchParams.get('q') ?? ''
  const excludeRaw = searchParams.get('exclude') ?? ''
  const excludeIds = excludeRaw ? excludeRaw.split(',').filter(Boolean) : []

  const pattern = `%${q}%`

  type Result = { id: string; label: string; sub?: string }
  let results: Result[] = []

  try {
    switch (objectType) {
      case 'accounts': {
        const rows = await db
          .select({ id: accounts.id, name: accounts.name, industry: accounts.industry })
          .from(accounts)
          .where(
            and(
              ilike(accounts.name, pattern),
              excludeIds.length > 0 ? notInArray(accounts.id, excludeIds) : undefined,
            )
          )
          .limit(MAX_RESULTS)
        results = rows.map((r) => ({ id: r.id, label: r.name, sub: r.industry ?? undefined }))
        break
      }

      case 'contacts': {
        const rows = await db
          .select({ id: contacts.id, full_name: contacts.full_name, title: contacts.title })
          .from(contacts)
          .where(
            and(
              ilike(contacts.full_name, pattern),
              excludeIds.length > 0 ? notInArray(contacts.id, excludeIds) : undefined,
            )
          )
          .limit(MAX_RESULTS)
        results = rows.map((r) => ({ id: r.id, label: r.full_name, sub: r.title ?? undefined }))
        break
      }

      case 'opportunities': {
        const rows = await db
          .select({ id: opportunities.id, name: opportunities.name, stage: opportunities.stage })
          .from(opportunities)
          .where(
            and(
              ilike(opportunities.name, pattern),
              excludeIds.length > 0 ? notInArray(opportunities.id, excludeIds) : undefined,
            )
          )
          .limit(MAX_RESULTS)
        results = rows.map((r) => ({ id: r.id, label: r.name, sub: r.stage ?? undefined }))
        break
      }

      default: {
        // カスタムオブジェクト（properties など）は custom_records を参照
        const objRows = await db
          .select({ id: object_definitions.id })
          .from(object_definitions)
          .where(eq(object_definitions.api_name, objectType))
          .limit(1)

        if (objRows.length === 0) {
          return NextResponse.json({ error: 'Unknown objectType' }, { status: 400 })
        }
        const objectId = objRows[0].id

        // custom_records の data（JSON blob）から全件取得し、メモリ内で name フィルタ
        // ※ JSON 列に対する LIKE は DB 側では難しいため、一旦全件引いてフィルタする
        // （件数が多い場合は PostgreSQL の ->> 演算子を使うよう最適化可能）
        const allRows = await db
          .select({ id: custom_records.id, data: custom_records.data })
          .from(custom_records)
          .where(
            excludeIds.length > 0
              ? and(eq(custom_records.object_id, objectId), notInArray(custom_records.id, excludeIds))
              : eq(custom_records.object_id, objectId)
          )

        const qLower = q.toLowerCase()
        results = allRows
          .map((r) => {
            let data: Record<string, unknown> = {}
            try { data = JSON.parse(r.data) } catch { /* ignore */ }
            const label = String(data.name ?? data.title ?? r.id)
            return { id: r.id, label, sub: data.status ? String(data.status) : undefined, _match: label.toLowerCase().includes(qLower) }
          })
          .filter((r) => r._match)
          .slice(0, MAX_RESULTS)
          .map(({ _match: _, ...r }) => r)
        break
      }
    }

    return NextResponse.json(results)
  } catch (e) {
    console.error('[search/records]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
