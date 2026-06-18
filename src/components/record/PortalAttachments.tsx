/**
 * 共有レコードのファイル添付（REQ-0084 Phase3）。ポータル/社内詳細で使う。
 * ダウンロードは権限チェック付き /api/attachments/[id]（外部=grant / 社内=可視）。
 * 投稿は canCommentOn 該当者のみ（account/contact/opportunity）。
 */
import { db } from '@/lib/db'
import { attachments } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { canCommentOn } from '@/lib/recordComments'
import { uploadPortalAttachment } from '@/app/actions/portalAttachments'
import { Paperclip, Download, Upload } from 'lucide-react'

const PARENT_COL = { account: attachments.account_id, contact: attachments.contact_id, opportunity: attachments.opportunity_id } as const

function fmtSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default async function PortalAttachments({
  objectApi, recordId, revalidatePath,
}: {
  objectApi: string
  recordId: string
  revalidatePath: string
}) {
  const col = PARENT_COL[objectApi as keyof typeof PARENT_COL]
  if (!col) return null // 添付の親列があるオブジェクトのみ

  const [files, canContribute] = await Promise.all([
    db.select({ id: attachments.id, file_name: attachments.file_name, file_size: attachments.file_size })
      .from(attachments).where(eq(col, recordId)).orderBy(attachments.created_at),
    canCommentOn(objectApi, recordId),
  ])

  async function upload(formData: FormData) {
    'use server'
    await uploadPortalAttachment(objectApi, recordId, formData, revalidatePath)
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-700">
        <Paperclip className="h-4 w-4 text-brand-600" strokeWidth={2} aria-hidden /> ファイル
        <span className="text-xs font-normal text-zinc-400">({files.length})</span>
      </h2>

      {files.length === 0 ? (
        <p className="mb-3 text-xs text-zinc-400">まだファイルはありません。</p>
      ) : (
        <ul className="mb-3 divide-y divide-zinc-100 rounded-lg border border-zinc-100">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="min-w-0 truncate text-sm text-zinc-700">{f.file_name}
                <span className="ml-2 text-[11px] text-zinc-400">{fmtSize(f.file_size)}</span>
              </span>
              <a href={`/api/attachments/${f.id}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 text-xs text-brand-700 hover:underline">
                <Download className="h-3.5 w-3.5" aria-hidden /> 開く
              </a>
            </li>
          ))}
        </ul>
      )}

      {canContribute && (
        <form action={upload} className="flex flex-wrap items-center gap-2">
          <input type="file" name="file" required className="min-w-0 flex-1 text-sm" />
          <button type="submit" className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">
            <Upload className="h-3.5 w-3.5" aria-hidden /> 追加
          </button>
        </form>
      )}
    </section>
  )
}
