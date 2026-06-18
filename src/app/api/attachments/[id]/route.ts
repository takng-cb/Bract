/**
 * GET /api/attachments/[id]
 *
 * 添付ファイルの権限チェック付きダウンロード（REQ-0083/0084・Phase4/Phase3）。
 * 公開バケット直リンク（誰でも取得可）を廃し、ここで:
 *   1. 認証
 *   2. 親レコードに対する可視性を確認
 *        - 社内: ブック Read 権限＋レコードスコープ（canSeeRecord / canDo）
 *        - 外部: 親レコードに有効な grant があること（ポータルの共有レコードの添付のみ）
 *   3. 許可時のみ署名 URL（60秒）を発行してリダイレクト（private バケットでも動作）
 */
import { db } from '@/lib/db'
import { attachments, accounts, contacts, opportunities, activities } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/auth'
import { canDo, canSeeRecord, isExternalUser, SCOPE_ENFORCED_BOOKS } from '@/lib/permissions'
import { userHasGrant } from '@/lib/recordGrants'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'

/** 親ブック（複数 api）→ grant 用の単数 api（共有対応の3種のみ）。 */
const GRANT_API: Record<string, string> = { accounts: 'account', contacts: 'contact', opportunities: 'opportunity' }

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
  const user = await getSupabaseUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  // 権限判定: 外部=親レコードへの grant / 社内=ブック Read＋レコードスコープ
  let allowed: boolean
  if (await isExternalUser()) {
    const singular = GRANT_API[parent.book]
    allowed = singular ? await userHasGrant(singular, parent.recordId, user.id) : false
  } else {
    allowed = SCOPE_ENFORCED_BOOKS.includes(parent.book)
      ? await canSeeRecord(parent.book, 'read', await fetchOwner(parent.book, parent.recordId))
      : await canDo(parent.book, 'read')
  }
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // 署名 URL を発行してリダイレクト（public/private いずれのバケットでも有効）
  const sb = createSupabaseAdminClient()
  const { data, error } = await sb.storage.from('attachments').createSignedUrl(att.storage_path, 60, { download: att.file_name })
  if (error || !data?.signedUrl) return NextResponse.json({ error: 'Storage error' }, { status: 500 })
  return NextResponse.redirect(data.signedUrl)
}
