/**
 * レコードコメント（REQ-0084 Phase3）。社内詳細・外部ポータルの両方で使う。
 * 閲覧は誰でも（呼び出し側がレコード可視性を担保）、投稿は canCommentOn 該当者のみ。
 */
import { listComments, canCommentOn } from '@/lib/recordComments'
import { createRecordComment } from '@/app/actions/recordComments'
import { fmtDateTime } from '@/lib/datetime'
import { MessageSquare, Send } from 'lucide-react'

export default async function RecordComments({
  objectApi, recordId, revalidatePath, tz,
}: {
  objectApi: string
  recordId: string
  revalidatePath: string
  tz?: string
}) {
  const [comments, canComment] = await Promise.all([
    listComments(objectApi, recordId),
    canCommentOn(objectApi, recordId),
  ])

  async function add(formData: FormData) {
    'use server'
    const body = (formData.get('body') as string) ?? ''
    await createRecordComment(objectApi, recordId, body, revalidatePath)
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-700">
        <MessageSquare className="h-4 w-4 text-brand-600" strokeWidth={2} aria-hidden /> コメント
        <span className="text-xs font-normal text-zinc-400">({comments.length})</span>
      </h2>

      {comments.length === 0 ? (
        <p className="mb-3 text-xs text-zinc-400">まだコメントはありません。</p>
      ) : (
        <ul className="mb-3 space-y-2.5">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg border border-zinc-100 bg-zinc-50/60 px-3 py-2">
              <div className="mb-0.5 flex items-center justify-between gap-2 text-[11px] text-zinc-400">
                <span className="truncate">{c.authorEmail ?? '—'}</span>
                <span className="shrink-0">{fmtDateTime(c.created_at, tz)}</span>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm text-zinc-800">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      {canComment && (
        <form action={add} className="space-y-2">
          <textarea
            name="body" required rows={2} maxLength={5000}
            placeholder="コメントを追加…"
            className="w-full resize-y rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <div className="text-right">
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">
              <Send className="h-3.5 w-3.5" aria-hidden /> 投稿
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
