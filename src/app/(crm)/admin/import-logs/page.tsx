import { db } from '@/lib/db'
import { import_logs } from '@/lib/schema'
import { requireAdmin } from '@/lib/auth'
import { desc } from 'drizzle-orm'
import PageHeader from '@/components/ui/PageHeader'

const ROUTE_LABELS: Record<string, string> = {
  '/api/import/properties':     '物件',
  '/api/import/vehicles':       '車両',
  '/api/import/contacts':       '人物',
  '/api/import/accounts':       '取引先',
  '/api/import/opportunities':  '商談',
  '/api/import/activities':     '活動',
  '/api/import/tasks':          'タスク',
  '/api/import/expenses':       '経費',
  '/api/import/business-cards': '名刺',
}

export default async function AdminImportLogsPage() {
  await requireAdmin()

  const logs = await db
    .select()
    .from(import_logs)
    .orderBy(desc(import_logs.created_at))
    .limit(200)

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <PageHeader icon="📥" title="インポートログ" description="直近 200 件のインポート実行履歴です（管理者のみ閲覧可能）" />

      {logs.length === 0 ? (
        <div className="text-center py-16 text-zinc-400 text-sm">ログがありません</div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            const userErrors: string[] = log.user_errors ? JSON.parse(log.user_errors) : []
            const rawErrors:  string[] = log.raw_errors  ? JSON.parse(log.raw_errors)  : []
            const hasError = userErrors.length > 0
            const routeLabel = ROUTE_LABELS[log.route] ?? log.route

            return (
              <div
                key={log.id}
                className={`bg-white border rounded-lg p-4 ${hasError ? 'border-amber-200' : 'border-zinc-200'}`}
              >
                {/* ヘッダー行 */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded">
                      {routeLabel}
                    </span>
                    <span className="text-sm text-zinc-700">
                      {log.imported > 0 && <span className="text-green-700 font-medium">{log.imported} 件追加</span>}
                      {log.imported > 0 && log.updated > 0 && <span className="text-zinc-400 mx-1">/</span>}
                      {log.updated  > 0 && <span className="text-blue-700 font-medium">{log.updated} 件更新</span>}
                      {log.imported === 0 && log.updated === 0 && <span className="text-zinc-400">変更なし</span>}
                    </span>
                    {hasError && (
                      <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                        ⚠ エラー {userErrors.length} 件
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-400">
                    {log.created_at
                      ? new Date(log.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
                      : '—'}
                  </span>
                </div>

                {/* エラー詳細 */}
                {hasError && (
                  <div className="mt-3 space-y-2">
                    {/* ユーザー向けエラー */}
                    <div className="bg-amber-50 border border-amber-100 rounded-md p-3">
                      <p className="text-xs font-semibold text-amber-700 mb-1">ユーザー向けエラー内容</p>
                      <ul className="space-y-0.5">
                        {userErrors.map((e, i) => (
                          <li key={i} className="text-xs text-amber-800">・{e}</li>
                        ))}
                      </ul>
                    </div>

                    {/* 管理者向けエラー（raw） */}
                    {rawErrors.length > 0 && (
                      <details className="bg-zinc-50 border border-zinc-200 rounded-md">
                        <summary className="text-xs font-semibold text-zinc-500 px-3 py-2 cursor-pointer select-none">
                          技術的エラー詳細（管理者用）
                        </summary>
                        <div className="px-3 pb-3">
                          <ul className="space-y-0.5">
                            {rawErrors.map((e, i) => (
                              <li key={i} className="text-xs text-zinc-500 font-mono break-all">・{e}</li>
                            ))}
                          </ul>
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
