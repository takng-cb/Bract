'use server'

/**
 * レコードコメントの作成（REQ-0084 Phase3）。
 * 外部ユーザー（grant あり）・社内ユーザー（閲覧可）が対象レコードにコメントを残す。
 */
import { db } from '@/lib/db'
import { record_comments } from '@/lib/schema'
import { revalidatePath } from 'next/cache'
import { getSupabaseUser } from '@/lib/auth'
import { canCommentOn, COMMENTABLE_OBJECTS } from '@/lib/recordComments'

export async function createRecordComment(
  objectApi: string, recordId: string, body: string, revalidate?: string,
): Promise<void> {
  const user = await getSupabaseUser()
  if (!user) throw new Error('ログインが必要です')
  if (!COMMENTABLE_OBJECTS.includes(objectApi)) throw new Error('このオブジェクトはコメント未対応です')

  const text = (body ?? '').trim()
  if (!text) throw new Error('コメントを入力してください')
  if (text.length > 5000) throw new Error('コメントは5000文字以内にしてください')

  // 外部=grant / 社内=閲覧可 を確認（直 POST 対策）
  if (!(await canCommentOn(objectApi, recordId))) throw new Error('このレコードにコメントする権限がありません')

  await db.insert(record_comments).values({ object_api: objectApi, record_id: recordId, author_id: user.id, body: text })
  if (revalidate) revalidatePath(revalidate)
}
