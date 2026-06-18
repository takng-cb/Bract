/**
 * GET /api/attachments/[id]
 *
 * 添付ファイルの権限チェック付きダウンロード（REQ-0083/0084・Phase4）。
 * 公開バケット直リンク（誰でも取得可）を廃し、ここで:
 *   1. 認証＋外部ユーザー遮断（requireApiUser）
 *   2. 親レコードの Read 権限＋レコードスコープ（canSeeRecord / canDo）を確認
 *   3. 許可時のみ署名 URL（60秒）を発行してリダイレクト（バケットが private でも動作）
 *
 * 運用: 本ルート導入後、Supabase の attachments バケットを private 化して公開直リンクを塞ぐ。
 */
import { db } from '@/lib/db'
import { attachments, accounts, contacts, opportunities, activities } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/apiAuth'
import { canDo, canSeeRecord, SCOPE_ENFORCED_BOOKS } from '@/lib/permissions'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'

/** 添付の親レコード owner_id を取得（スコープ強制ブックのみ）。 */
async function fetchOwner(book: string, recordId: string): Promise<string | null> {
  switch (book) {
    case 'accounts':      return (await db.select({ o: accounts.owner_id }).from(accounts).where(eq(accounts.id, recordId)))[0]?.o ?? null
    case 'contacts':      return (await db.select({ o: contacts.owner_id }).from(contacts).where(eq(contacts.id, recordId)))[0]?.o ?? null
    case 'opportunities': return (await db.select({ o: opportunities.owner_id }).from(opportunities).where(eq(opportunities.id, recordId)))[0]?.o ?? null
    case 'activities':    return (await db.select({ o: activities.owner_id }).from(activities).where(eq(activities.id, recordId)))[0]?.o ?? null
    default:              return null
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  // 認証＋外部ユーザー遮断
  const denied = await requireApiUser()
  if (denied) return denied

  const { id } = await params
  const [att] = await db.select().from(attachments).where(eq(attachments.id, id))
  if (!att) return NextResponse.json({ error: 'Not Found' }, { status: 404 })

  // 親レコードを特定（添付は単一の親に属する）
  const parent =
    att.account_id        ? { book: 'accounts',            recordId: att.account_id }
    : att.contact_id      ? { book: 'contacts',            recordId: att.contact_id }
    : att.opportunity_id  ? { book: 'opportunities',       recordId: att.opportunity_id }
    : att.activity_id     ? { book: 'activities',          recordId: att.activity_id }
    : att.maintenance_id  ? { book: 'maintenance_records', recordId: att.maintenance_id }
    : att.customer_vehicle_id ? { book: 'customer_vehicles', recordId: att.customer_vehicle_id }
    : null

  // 親不明の添付は保守的に拒否（誰の権限で見せるか不明なため）
  if (!parent) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // 権限: スコープ強制ブックは owner スコープ込み、その他はブック Read
  const allowed = SCOPE_ENFORCED_BOOKS.includes(parent.book)
    ? await canSeeRecord(parent.book, 'read', await fetchOwner(parent.book, parent.recordId))
    : await canDo(parent.book, 'read')
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // 署名 URL を発行してリダイレクト（public/private いずれのバケットでも有効）
  const sb = createSupabaseAdminClient()
  const { data, error } = await sb.storage.from('attachments').createSignedUrl(att.storage_path, 60, { download: att.file_name })
  if (error || !data?.signedUrl) return NextResponse.json({ error: 'Storage error' }, { status: 500 })
  return NextResponse.redirect(data.signedUrl)
}
