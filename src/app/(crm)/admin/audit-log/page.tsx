import { db } from '@/lib/db'
import { change_logs } from '@/lib/schema'
import { requireAdmin } from '@/lib/auth'
import { desc, eq, and, gte, lte, count, type SQL } from 'drizzle-orm'
import Link from 'next/link'
import PageHeader from '@/components/ui/PageHeader'

const PAGE_SIZE = 50

/**
 * 全社の変更履歴を横断閲覧する管理画面（Issue #29）。
 *
 * フィルタ可能項目:
 *   - 期間（from / to、changed_at に対して）
 *   - オブジェクト種別（object_type のセレクト）
 *
 * 未対応（将来課題、別 Issue）:
 *   - ユーザーによる絞り込み（change_logs.changed_by 列が schema に未追加）
 *   - 削除レコードの「最終状態」復元
 *   - CSV エクスポート（必要になり次第 /api/export/audit-log 追加）
 */

// object_type → 人間可読ラベル + 詳細リンクテンプレート
const OBJECT_TYPE_META: Record<string, { label: string; href?: (id: string) => string }> = {
  account:       { label: '取引先',  href: (id) => `/accounts/${id}` },
  contact:       { label: '人物',    href: (id) => `/contacts/${id}` },
  opportunity:   { label: '商談',    href: (id) => `/opportunities/${id}` },
  activity:      { label: '活動',    href: (id) => `/activities/${id}` },
  task:          { label: 'ToDo',    href: (id) => `/tasks/${id}` },
  expense:       { label: '経費',    href: (id) => `/expenses/${id}` },
  property:      { label: '物件',    href: (id) => `/properties/${id}` },
  vehicle:       { label: '車両',    href: (id) => `/vehicles/${id}` },
  part:          { label: '部品',    href: (id) => `/parts/${id}` },
  custom_record: { label: 'カスタム', href: (id) => `/objects/_/${id}` },
}

function truncate(s: string | null, maxLen = 80): string {
  if (!s) return '—'
  if (s.length <= maxLen) return s
  return s.slice(0, maxLen) + '…'
}

function parseDate(v: string | undefined): Date | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; obj?: string; page?: string }>
}) {
  await requireAdmin()
  const sp = await searchParams

  const from     = parseDate(sp.from)
  const to       = parseDate(sp.to)
  const objType  = sp.obj ?? ''
  const page     = Math.max(1, parseInt(sp.page ?? '1', 10))

  // ── where 条件を組み立て ────────────────────────────────
  const conditions: SQL[] = []
  if (from)    conditions.push(gte(change_logs.changed_at, from))
  if (to)      conditions.push(lte(change_logs.changed_at, to))
  if (objType) conditions.push(eq(change_logs.object_type, objType))
  const where = conditions.length > 0 ? and(...conditions) : undefined

  // ── データ取得（並列）────────────────────────────────────
  const [rows, totalRow] = await Promise.all([
    db.select()
      .from(change_logs)
      .where(where)
      .orderBy(desc(change_logs.changed_at))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() })
      .from(change_logs)
      .where(where),
  ])
  const total      = Number(totalRow[0]?.n ?? 0)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // URL ヘルパー
  const buildHref = (params: Partial<typeof sp>) => {
    const u = new URLSearchParams()
    const merged = { from: sp.from, to: sp.to, obj: sp.obj, ...params }
    if (merged.from) u.set('from', merged.from)
    if (merged.to)   u.set('to',   merged.to)
    if (merged.obj)  u.set('obj',  merged.obj)
    if (params.page && params.page !== '1') u.set('page', params.page)
    const q = u.toString()
    return q ? `/admin/audit-log?${q}` : '/admin/audit-log'
  }

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <PageHeader
        icon="📝"
        title="監査ログ（変更履歴）"
        description={`全 ${total.toLocaleString()} 件の変更履歴。新しい順。管理者のみ閲覧可能。`}
      />

      {/* フィルタフォーム */}
      <form action="/admin/audit-log" method="get" className="bg-white border border-zinc-200 rounded-lg shadow-xs p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">期間: 開始日</label>
            <input
              type="date"
              name="from"
              defaultValue={sp.from ?? ''}
              className="w-full border border-zinc-300 rounded-md px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">期間: 終了日</label>
            <input
              type="date"
              name="to"
              defaultValue={sp.to ?? ''}
              className="w-full border border-zinc-300 rounded-md px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">オブジェクト種別</label>
            <select
              name="obj"
              defaultValue={sp.obj ?? ''}
              className="w-full border border-zinc-300 rounded-md px-2 py-1 text-sm bg-white"
            >
              <option value="">すべて</option>
              {Object.entries(OBJECT_TYPE_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}（{k}）</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
              絞り込み
            </button>
            <Link
              href="/admin/audit-log"
              className="px-3 py-1.5 border border-zinc-300 text-zinc-600 text-sm rounded-md hover:bg-zinc-50"
            >
              クリア
            </Link>
          </div>
        </div>
      </form>

      {/* 一覧テーブル（PC） */}
      {rows.length === 0 ? (
        <div className="text-center py-16 text-zinc-400 text-sm">該当する変更履歴がありません</div>
      ) : (
        <>
          <div className="hidden md:block bg-white border border-zinc-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-zinc-600 w-40">日時</th>
                  <th className="text-left px-4 py-2 font-medium text-zinc-600 w-28">種別</th>
                  <th className="text-left px-4 py-2 font-medium text-zinc-600">フィールド</th>
                  <th className="text-left px-4 py-2 font-medium text-zinc-600">変更前</th>
                  <th className="text-left px-4 py-2 font-medium text-zinc-600">変更後</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((r) => {
                  const meta = OBJECT_TYPE_META[r.object_type]
                  const href = meta?.href?.(r.object_id)
                  return (
                    <tr key={r.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-2 text-xs text-zinc-500 whitespace-nowrap">
                        {r.changed_at
                          ? new Date(r.changed_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
                          : '—'}
                      </td>
                      <td className="px-4 py-2">
                        {href ? (
                          <Link href={href} className="text-xs font-semibold text-blue-600 hover:underline">
                            {meta?.label ?? r.object_type}
                          </Link>
                        ) : (
                          <span className="text-xs font-semibold text-zinc-600">{meta?.label ?? r.object_type}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-zinc-800">{r.field_label}</td>
                      <td className="px-4 py-2 text-xs text-zinc-500 whitespace-pre-wrap break-words">
                        {truncate(r.old_value)}
                      </td>
                      <td className="px-4 py-2 text-xs text-zinc-800 whitespace-pre-wrap break-words">
                        {truncate(r.new_value)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* モバイル: カード */}
          <div className="md:hidden space-y-2">
            {rows.map((r) => {
              const meta = OBJECT_TYPE_META[r.object_type]
              const href = meta?.href?.(r.object_id)
              return (
                <div key={r.id} className="bg-white border border-zinc-200 rounded-lg px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    {href ? (
                      <Link href={href} className="text-xs font-semibold text-blue-600 hover:underline">
                        {meta?.label ?? r.object_type}
                      </Link>
                    ) : (
                      <span className="text-xs font-semibold text-zinc-600">{meta?.label ?? r.object_type}</span>
                    )}
                    <span className="text-xs text-zinc-400">
                      {r.changed_at
                        ? new Date(r.changed_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
                        : '—'}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-800 mt-1.5">{r.field_label}</p>
                  <div className="text-xs text-zinc-500 mt-1 whitespace-pre-wrap break-words">
                    <span className="text-zinc-400">変更前:</span> {truncate(r.old_value, 60)}
                  </div>
                  <div className="text-xs text-zinc-800 mt-0.5 whitespace-pre-wrap break-words">
                    <span className="text-zinc-400">変更後:</span> {truncate(r.new_value, 60)}
                  </div>
                </div>
              )
            })}
          </div>

          {/* ページング */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 text-sm">
              <div className="text-zinc-500">
                {((page - 1) * PAGE_SIZE + 1).toLocaleString()}–
                {Math.min(page * PAGE_SIZE, total).toLocaleString()} / {total.toLocaleString()} 件
              </div>
              <div className="flex items-center gap-2">
                {page > 1 ? (
                  <Link
                    href={buildHref({ page: String(page - 1) })}
                    className="px-3 py-1.5 border border-zinc-300 rounded-md hover:bg-zinc-50"
                  >
                    ← 前へ
                  </Link>
                ) : (
                  <span className="px-3 py-1.5 border border-zinc-200 text-zinc-300 rounded-md cursor-not-allowed">← 前へ</span>
                )}
                <span className="text-zinc-500">{page} / {totalPages}</span>
                {page < totalPages ? (
                  <Link
                    href={buildHref({ page: String(page + 1) })}
                    className="px-3 py-1.5 border border-zinc-300 rounded-md hover:bg-zinc-50"
                  >
                    次へ →
                  </Link>
                ) : (
                  <span className="px-3 py-1.5 border border-zinc-200 text-zinc-300 rounded-md cursor-not-allowed">次へ →</span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
