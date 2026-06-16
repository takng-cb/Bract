'use server'

/**
 * record_links（汎用双方向リンク。REQ-0078）の追加・削除サーバアクション。
 * - リンクは「self レコードの編集」とみなし、self ブックの update 権限で gate（ADR-0023）。
 * - 双方向は normalizePair で正規化して 1 行で保存（ON CONFLICT DO NOTHING で冪等）。
 * - 追加時は解決済みレコード（label/href/icon）を返し、クライアントが即時にチップ追加できる。
 */
import { db } from '@/lib/db'
import { record_links } from '@/lib/schema'
import { and, eq, or } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { canDo } from '@/lib/permissions'
import {
  normalizePair, bookForObjectApi, type LinkEnd,
} from '@/lib/recordLinks'
import { resolveRelatedRecords, recordHref, type ResolvedRecord } from '@/lib/relatedRecords'

type AddResult = { ok: true; record: ResolvedRecord } | { ok: false; error: string }
type RemoveResult = { ok: true } | { ok: false; error: string }

function sameEnd(a: LinkEnd, b: LinkEnd) {
  return a.object_api === b.object_api && a.record_id === b.record_id
}

export async function addRecordLink(self: LinkEnd, target: LinkEnd): Promise<AddResult> {
  if (sameEnd(self, target)) return { ok: false, error: '同じレコード同士は関連付けられません' }

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '認証が必要です' }

  // self レコードの編集権限（read だけのユーザーには関連付けさせない）
  if (!(await canDo(bookForObjectApi(self.object_api), 'update'))) {
    return { ok: false, error: '関連付ける権限がありません' }
  }

  const pair = normalizePair(self, target)
  await db.insert(record_links)
    .values({ ...pair, created_by: user.id })
    .onConflictDoNothing({
      target: [record_links.a_object_api, record_links.a_record_id, record_links.b_object_api, record_links.b_record_id],
    })

  const [resolved] = await resolveRelatedRecords([target])
  // 双方向なので両端の詳細ページを再検証
  revalidatePath(recordHref(self.object_api, self.record_id))
  revalidatePath(recordHref(target.object_api, target.record_id))

  return { ok: true, record: resolved }
}

export async function removeRecordLink(self: LinkEnd, target: LinkEnd): Promise<RemoveResult> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '認証が必要です' }

  if (!(await canDo(bookForObjectApi(self.object_api), 'update'))) {
    return { ok: false, error: '関連を解除する権限がありません' }
  }

  const pair = normalizePair(self, target)
  await db.delete(record_links).where(or(
    and(
      eq(record_links.a_object_api, pair.a_object_api), eq(record_links.a_record_id, pair.a_record_id),
      eq(record_links.b_object_api, pair.b_object_api), eq(record_links.b_record_id, pair.b_record_id),
    ),
  ))

  revalidatePath(recordHref(self.object_api, self.record_id))
  revalidatePath(recordHref(target.object_api, target.record_id))

  return { ok: true }
}
