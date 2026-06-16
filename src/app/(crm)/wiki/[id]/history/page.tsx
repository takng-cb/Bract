/**
 * /wiki/[id]/history — Wiki の版差分（変更履歴）表示 (#129)。
 *
 * change_logs（object_type='wiki_pages'）から本文・タイトルの変更を新しい順に表示。
 * 本文は行単位 diff（追加=緑 / 削除=赤、変更の無い区間は折りたたみ）。
 * 各版の「この版の前に戻す / 後に戻す」で本文を復元できる（復元も新しい版として記録）。
 * 履歴の記録は本機能の導入以降の編集が対象。
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { History, BookOpen, Undo2 } from 'lucide-react'
import { isModuleEnabled } from '@/lib/modules/registry'
import { db } from '@/lib/db'
import { wiki_pages, change_logs } from '@/lib/schema'
import { eq, and, desc } from 'drizzle-orm'
import RecordHeader from '@/components/RecordHeader'
import AuthGuard from '@/components/AuthGuard'
import { diffLines, collapseUnchanged } from '@/lib/textDiff'
import { restoreWikiBody } from '@/app/actions/wiki'
import { requireBookRead } from '@/lib/permissions'
import { getAppTimeZone } from '@/lib/systemSettings'
import { fmtDateTime } from '@/lib/datetime'

export const dynamic = 'force-dynamic'

function DiffView({ oldText, newText }: { oldText: string; newText: string }) {
  const hunks = collapseUnchanged(diffLines(oldText, newText), 2)
  return (
    <pre className="text-xs leading-relaxed font-mono whitespace-pre-wrap break-words rounded-md border border-zinc-200 overflow-hidden">
      {hunks.map((h, i) => {
        if (h.type === 'skip') {
          return <div key={i} className="px-3 py-0.5 bg-zinc-50 text-zinc-400 select-none">… {h.count} 行省略 …</div>
        }
        const cls = h.type === 'add' ? 'bg-green-50 text-green-900'
          : h.type === 'del' ? 'bg-red-50 text-red-800 line-through decoration-red-300'
          : 'bg-white text-zinc-700'
        const mark = h.type === 'add' ? '＋' : h.type === 'del' ? '－' : '　'
        return (
          <div key={i} className={`px-3 ${cls}`}>
            <span className="select-none mr-1 opacity-60">{mark}</span>{h.text || ' '}
          </div>
        )
      })}
    </pre>
  )
}

export default async function WikiHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireBookRead('wiki_pages')  // RBAC: Read 権限ガード（ADR-0023）
  const { id } = await params
  if (!(await isModuleEnabled('workspace'))) notFound()

  const [page, logs] = await Promise.all([
    db.select({ id: wiki_pages.id, title: wiki_pages.title })
      .from(wiki_pages).where(eq(wiki_pages.id, id)).then((r) => r[0] ?? null),
    db.select()
      .from(change_logs)
      .where(and(eq(change_logs.object_type, 'wiki_pages'), eq(change_logs.object_id, id)))
      .orderBy(desc(change_logs.changed_at))
      .limit(50),
  ])
  if (!page) notFound()

  const tz = await getAppTimeZone()
  const fmt = (d: Date | null) => fmtDateTime(d, tz)

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <RecordHeader
        crumbs={[
          { label: 'Wiki', href: '/wiki' },
          { label: page.title, href: `/wiki/${id}` },
          { label: '変更履歴' },
        ]}
        avatar={<History className="w-6 h-6" strokeWidth={2.25} aria-hidden />}
        title={`${page.title} の変更履歴`}
        actions={
          <Link href={`/wiki/${id}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50">
            <BookOpen className="w-4 h-4" strokeWidth={2.25} aria-hidden /> ページへ戻る
          </Link>
        }
      />

      {logs.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 text-sm text-zinc-500">
          記録された変更はまだありません（履歴はこの機能の導入以降の編集が対象です）。
        </div>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => {
            const restoreOld = restoreWikiBody.bind(null, id, log.id, 'old')
            return (
              <div key={log.id} className="bg-white border border-zinc-200 rounded-lg shadow-xs">
                <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-100 flex-wrap">
                  <span className="text-sm font-semibold text-zinc-800">{log.field_label}の変更</span>
                  <span className="text-xs text-zinc-400">{fmt(log.changed_at)}</span>
                  <div className="flex-1" />
                  {log.field_name === 'body' && (
                    <AuthGuard minRole="editor">
                      <form action={restoreOld}>
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
                          title="この変更が行われる前の本文に戻す（戻す操作も履歴に残ります）"
                        >
                          <Undo2 className="w-3.5 h-3.5" aria-hidden /> この変更前に戻す
                        </button>
                      </form>
                    </AuthGuard>
                  )}
                </div>
                <div className="p-4">
                  {log.field_name === 'body' ? (
                    <DiffView oldText={log.old_value ?? ''} newText={log.new_value ?? ''} />
                  ) : (
                    <p className="text-sm text-zinc-700">
                      <span className="bg-red-50 text-red-800 line-through px-1 rounded">{log.old_value ?? '（空）'}</span>
                      <span className="mx-2 text-zinc-400">→</span>
                      <span className="bg-green-50 text-green-900 px-1 rounded">{log.new_value ?? '（空）'}</span>
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
