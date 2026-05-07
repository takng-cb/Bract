import { getObjectDef, getFieldDefs } from '@/lib/objectMetadata'
import { db } from '@/lib/db'
import { custom_records, accounts, contacts } from '@/lib/schema'
import { eq, desc, inArray } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { canEdit } from '@/lib/auth'
import CsvToolbar from '@/components/CsvToolbar'

export default async function CustomObjectListPage({
  params,
}: {
  params: Promise<{ objectApiName: string }>
}) {
  const { objectApiName } = await params

  // ── Round 1: オブジェクト定義取得（キャッシュ済みなので高速） ──
  const [obj, edit] = await Promise.all([
    getObjectDef(objectApiName),
    canEdit(),
  ])
  if (!obj) notFound()

  // ── Round 2: フィールド定義とレコードを並列取得 ──────────────────
  const [fields, records] = await Promise.all([
    getFieldDefs(obj.id),
    db.select()
      .from(custom_records)
      .where(eq(custom_records.object_id, obj.id))
      .orderBy(desc(custom_records.created_at)),
  ])

  const visibleFields = fields.filter((f) => f.is_visible && f.field_type !== 'section')

  const parsedRecords = records.map((r) => {
    let data: Record<string, unknown> = {}
    try { data = JSON.parse(r.data) } catch { /* ignore */ }
    return { ...r, data }
  })

  // ── account_id / contact_id を一括ルックアップ ──
  const accountIdApiNames = new Set(
    visibleFields.filter((f) => f.api_name === 'account_id' || f.api_name.endsWith('_account_id')).map((f) => f.api_name)
  )
  const contactIdApiNames = new Set(
    visibleFields.filter((f) => f.api_name === 'contact_id' || f.api_name.endsWith('_contact_id')).map((f) => f.api_name)
  )

  const accountIdSet = new Set<string>()
  const contactIdSet = new Set<string>()
  for (const r of parsedRecords) {
    for (const an of accountIdApiNames) {
      const v = String(r.data[an] ?? '').trim()
      if (v) accountIdSet.add(v)
    }
    for (const cn of contactIdApiNames) {
      const v = String(r.data[cn] ?? '').trim()
      if (v) contactIdSet.add(v)
    }
  }

  const [accountRows, contactRows] = await Promise.all([
    accountIdSet.size > 0
      ? db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(inArray(accounts.id, [...accountIdSet]))
      : Promise.resolve([]),
    contactIdSet.size > 0
      ? db.select({ id: contacts.id, name: contacts.full_name }).from(contacts).where(inArray(contacts.id, [...contactIdSet]))
      : Promise.resolve([]),
  ])
  const accountMap = new Map(accountRows.map((a) => [a.id, a.name]))
  const contactMap = new Map(contactRows.map((c) => [c.id, c.name]))

  // 一覧に表示する代表フィールドを最大 4 列選ぶ（_id 系フィールドを除く）
  const listFields = visibleFields
    .filter((f) => !accountIdApiNames.has(f.api_name) && !contactIdApiNames.has(f.api_name))
    .slice(0, 4)

  // CSV インポートのフォーマット文字列
  const csvFormat = ['ID', ...visibleFields.map((f) => f.label)].join(',')

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">
            {obj.icon} {obj.label_plural}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">全 {parsedRecords.length} 件</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <CsvToolbar
            exportUrl={`/api/export/custom/${objectApiName}`}
            importUrl={`/api/import/custom/${objectApiName}`}
            label={obj.label}
            csvFormat={csvFormat}
            showImport={edit}
          />
          {edit && (
            <Link
              href={`/objects/${objectApiName}/new`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              ＋ 新規登録
            </Link>
          )}
        </div>
      </div>

      {parsedRecords.length === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <p className="text-4xl mb-4">{obj.icon}</p>
          <p className="text-lg font-medium">{obj.label}がまだありません</p>
          {edit && <p className="text-sm mt-1">「新規登録」ボタンから追加してください</p>}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                {listFields.map((f) => (
                  <th key={f.id} className="text-left px-4 py-3 font-medium text-zinc-600">
                    {f.label}
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-medium text-zinc-600">登録日</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {parsedRecords.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-50 transition-colors">
                  {listFields.map((f) => (
                    <td key={f.id} className="px-4 py-3 text-zinc-700 max-w-[12rem] truncate">
                      {formatCellValue(f.field_type, r.data[f.api_name])}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right text-xs text-zinc-400 whitespace-nowrap">
                    {r.created_at ? new Date(r.created_at).toLocaleDateString('ja-JP') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/objects/${objectApiName}/${r.id}`}
                      className="text-blue-600 hover:text-blue-800 text-xs"
                    >
                      詳細 →
                    </Link>
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

function formatCellValue(fieldType: string, value: unknown): string {
  if (value == null || value === '') return '—'
  switch (fieldType) {
    case 'boolean': return value ? '✅' : '—'
    case 'number':  return Number(value).toLocaleString('ja-JP')
    default:        return String(value)
  }
}
