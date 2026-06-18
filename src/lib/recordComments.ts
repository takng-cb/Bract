/**
 * レコードコメント（REQ-0084 Phase3）の読み取り＋アクセス判定。
 * object_api は record_grants と同じ単数規約（account/contact/opportunity/project）。
 *
 * コメント可否:
 *   - 外部ユーザー: そのレコードに有効な grant がある
 *   - 社内ユーザー: そのレコードを閲覧できる（canSeeRecord）
 */
import 'server-only'
import { db } from '@/lib/db'
import { record_comments, users, accounts, contacts, opportunities, projects } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import { getSupabaseUser } from '@/lib/auth'
import { isExternalUser, canSeeRecord } from '@/lib/permissions'
import { userHasGrant } from '@/lib/recordGrants'

/** コメント対応オブジェクト（単数 api）→ canSeeRecord 用の book_api（複数）。 */
const BOOK_FOR: Record<string, string> = {
  account: 'accounts', contact: 'contacts', opportunity: 'opportunities', project: 'projects',
}

export const COMMENTABLE_OBJECTS = Object.keys(BOOK_FOR)

async function recordOwner(objectApi: string, recordId: string): Promise<string | null> {
  switch (objectApi) {
    case 'account':     return (await db.select({ o: accounts.owner_id }).from(accounts).where(eq(accounts.id, recordId)))[0]?.o ?? null
    case 'contact':     return (await db.select({ o: contacts.owner_id }).from(contacts).where(eq(contacts.id, recordId)))[0]?.o ?? null
    case 'opportunity': return (await db.select({ o: opportunities.owner_id }).from(opportunities).where(eq(opportunities.id, recordId)))[0]?.o ?? null
    case 'project':     return (await db.select({ o: projects.owner_id }).from(projects).where(eq(projects.id, recordId)))[0]?.o ?? null
    default:            return null
  }
}

/** 現在ユーザーがこのレコードにコメントできるか（外部=grant / 社内=閲覧可）。 */
export async function canCommentOn(objectApi: string, recordId: string): Promise<boolean> {
  const user = await getSupabaseUser()
  if (!user) return false
  if (!BOOK_FOR[objectApi]) return false
  if (await isExternalUser()) return userHasGrant(objectApi, recordId, user.id)
  return canSeeRecord(BOOK_FOR[objectApi], 'read', await recordOwner(objectApi, recordId))
}

export type RecordComment = { id: string; body: string; created_at: Date | null; authorEmail: string | null }

/** レコードのコメント一覧（古い順）。 */
export async function listComments(objectApi: string, recordId: string): Promise<RecordComment[]> {
  const rows = await db
    .select({ id: record_comments.id, body: record_comments.body, created_at: record_comments.created_at, email: users.email })
    .from(record_comments)
    .leftJoin(users, eq(users.id, record_comments.author_id))
    .where(and(eq(record_comments.object_api, objectApi), eq(record_comments.record_id, recordId)))
    .orderBy(record_comments.created_at)
  return rows.map((r) => ({ id: r.id, body: r.body, created_at: r.created_at, authorEmail: r.email }))
}
