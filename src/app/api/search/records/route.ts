/**
 * GET /api/search/records?objectType=opportunities&q=テスト&exclude=id1,id2
 *
 * 関係性追加UI用のレコード検索エンドポイント。
 * objectType 別にレコード名を前方一致検索して返す。
 */

import { db } from '@/lib/db'
import { accounts, contacts, opportunities, properties } from '@/lib/schema'
import { ilike, notInArray, and } from 'drizzle-orm'
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

      case 'properties': {
        const rows = await db
          .select({ id: properties.id, name: properties.name, status: properties.status })
          .from(properties)
          .where(
            and(
              ilike(properties.name, pattern),
              excludeIds.length > 0 ? notInArray(properties.id, excludeIds) : undefined,
            )
          )
          .limit(MAX_RESULTS)
        results = rows.map((r) => ({ id: r.id, label: r.name, sub: r.status ?? undefined }))
        break
      }

      default:
        return NextResponse.json({ error: 'Unknown objectType' }, { status: 400 })
    }

    return NextResponse.json(results)
  } catch (e) {
    console.error('[search/records]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
