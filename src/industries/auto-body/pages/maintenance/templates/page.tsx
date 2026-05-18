/**
 * 整備パッケージ（テンプレート）一覧。
 *
 * よくある作業セットを保存しておくと、整備の行アイテム編集画面から
 * 1 クリックで投入できる。
 */
import { db } from '@/lib/db'
import { maintenance_templates, maintenance_template_lines, maintenance_template_fees } from '@/lib/schema'
import { asc, eq, sql } from 'drizzle-orm'
import Link from 'next/link'
import { canEdit } from '@/lib/auth'
import { AB_ICONS } from '@/industries/auto-body/lib/icons'

export default async function TemplatesPage() {
  const [rows, edit] = await Promise.all([
    db.select({
      id:          maintenance_templates.id,
      name:        maintenance_templates.name,
      description: maintenance_templates.description,
      category:    maintenance_templates.category,
      is_active:   maintenance_templates.is_active,
      sort_order:  maintenance_templates.sort_order,
      line_count:  sql<number>`(SELECT count(*)::int FROM ${maintenance_template_lines} WHERE template_id = ${maintenance_templates.id})`,
      fee_count:   sql<number>`(SELECT count(*)::int FROM ${maintenance_template_fees}  WHERE template_id = ${maintenance_templates.id})`,
    })
      .from(maintenance_templates)
      .orderBy(asc(maintenance_templates.sort_order), asc(maintenance_templates.name)),
    canEdit(),
  ])
  void eq

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{AB_ICONS.template} 整備パッケージ</h1>
          <p className="text-sm text-zinc-500 mt-1">よくある作業セットをテンプレ化。整備の行アイテム編集から 1 クリックで投入できます。</p>
        </div>
        {edit && (
          <Link href="/maintenance/templates/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors shadow-sm">
            ＋ テンプレを作成
          </Link>
        )}
      </div>

      <p className="mb-4">
        <Link href="/maintenance" className="text-xs text-zinc-500 hover:text-blue-700">← 整備一覧に戻る</Link>
      </p>

      {rows.length === 0 ? (
        <div className="text-center py-16 text-zinc-400 bg-white border border-zinc-200 rounded-lg">
          <p className="text-4xl mb-3">{AB_ICONS.template}</p>
          <p className="text-base font-medium">テンプレートはまだありません</p>
          <p className="text-sm mt-1">「テンプレを作成」ボタンから追加してください</p>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-zinc-700">テンプレ名</th>
                <th className="text-left px-4 py-2 font-medium text-zinc-700">カテゴリ</th>
                <th className="text-right px-4 py-2 font-medium text-zinc-700">作業項目</th>
                <th className="text-right px-4 py-2 font-medium text-zinc-700">諸費用</th>
                <th className="text-center px-4 py-2 font-medium text-zinc-700">状態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((t) => (
                <tr key={t.id} className="hover:bg-zinc-50/30">
                  <td className="px-4 py-3">
                    <Link href={`/maintenance/templates/${t.id}`} className="text-blue-600 hover:text-blue-800 hover:underline font-medium">
                      {AB_ICONS.template} {t.name}
                    </Link>
                    {t.description && <p className="text-xs text-zinc-500 mt-0.5">{t.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{t.category ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-700">{Number(t.line_count)}</td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-700">{Number(t.fee_count)}</td>
                  <td className="px-4 py-3 text-center">
                    {t.is_active
                      ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">有効</span>
                      : <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500">無効</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
