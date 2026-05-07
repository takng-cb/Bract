import { getObjectDef, getFieldDefs, parseFieldOptions } from '@/lib/objectMetadata'
import { db } from '@/lib/db'
import { custom_records, accounts, contacts } from '@/lib/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { canEdit } from '@/lib/auth'
import { deleteCustomRecord } from '@/app/actions/customRecords'
import DeleteButton from '@/components/DeleteButton'
import RelatedRecordsSection from '@/components/RelatedRecordsSection'
import { evalFormula } from '@/lib/formulaEval'

export default async function CustomRecordDetailPage({
  params,
}: {
  params: Promise<{ objectApiName: string; recordId: string }>
}) {
  const { objectApiName, recordId } = await params

  const [obj, edit] = await Promise.all([
    getObjectDef(objectApiName),
    canEdit(),
  ])
  if (!obj) notFound()

  const [record, fields] = await Promise.all([
    db.select().from(custom_records)
      .where(and(eq(custom_records.id, recordId), eq(custom_records.object_id, obj.id)))
      .then((r) => r[0] ?? null),
    getFieldDefs(obj.id),
  ])
  if (!record) notFound()

  let data: Record<string, unknown> = {}
  try { data = JSON.parse(record.data) } catch { /* ignore */ }

  const visibleFields = fields.filter((f) => f.is_visible)

  // ── account_id / contact_id フィールドの ID を一括ルックアップ ──
  const accountIdApiNames = new Set(
    visibleFields.filter((f) => f.api_name === 'account_id' || f.api_name.endsWith('_account_id')).map((f) => f.api_name)
  )
  const contactIdApiNames = new Set(
    visibleFields.filter((f) => f.api_name === 'contact_id' || f.api_name.endsWith('_contact_id')).map((f) => f.api_name)
  )

  const accountIdList = [...accountIdApiNames].map((an) => String(data[an] ?? '')).filter(Boolean)
  const contactIdList = [...contactIdApiNames].map((cn) => String(data[cn] ?? '')).filter(Boolean)

  const [accountRows, contactRows] = await Promise.all([
    accountIdList.length > 0
      ? db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(inArray(accounts.id, accountIdList))
      : Promise.resolve([]),
    contactIdList.length > 0
      ? db.select({ id: contacts.id, name: contacts.full_name }).from(contacts).where(inArray(contacts.id, contactIdList))
      : Promise.resolve([]),
  ])
  const accountMap = new Map(accountRows.map((a) => [a.id, a.name]))
  const contactMap = new Map(contactRows.map((c) => [c.id, c.name]))

  // レコードのタイトル（name フィールドを優先）
  const recordTitle = String(data.name ?? data.title ?? `${obj.label} #${recordId.slice(0, 8)}`)

  async function handleDelete() {
    'use server'
    await deleteCustomRecord(objectApiName, recordId)
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      {/* パンくず＋アクション */}
      <div className="mb-6">
        <Link href={`/objects/${objectApiName}`} className="text-sm text-zinc-400 hover:text-zinc-600">
          ← {obj.label_plural}
        </Link>
        <div className="flex items-start justify-between mt-2 gap-4">
          <h1 className="text-2xl font-bold text-zinc-900 break-words">
            {obj.icon} {recordTitle}
          </h1>
          {edit && (
            <div className="flex gap-2 shrink-0">
              <Link
                href={`/objects/${objectApiName}/${recordId}/edit`}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
              >
                ✏️ 編集
              </Link>
              <DeleteButton
                action={handleDelete}
                confirmMessage={`この${obj.label}を削除しますか？`}
              />
            </div>
          )}
        </div>
      </div>

      {/* フィールド表示 */}
      <div className="bg-white rounded-lg border border-zinc-200 p-6 mb-6">
        {visibleFields.length === 0 ? (
          <p className="text-sm text-zinc-400">フィールドが定義されていません。管理画面でフィールドを追加してください。</p>
        ) : (
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            {visibleFields.map((field) => {
              if (field.field_type === 'section') {
                return (
                  <div key={field.id} className="col-span-full pt-3 pb-1 border-b-2 border-zinc-100">
                    <p className="text-sm font-semibold text-zinc-600">{field.label}</p>
                  </div>
                )
              }
              const val = data[field.api_name]

              // account_id フィールド → 取引先リンク
              if (accountIdApiNames.has(field.api_name)) {
                const id = String(val ?? '').trim()
                const name = id ? accountMap.get(id) : null
                return (
                  <div key={field.id}>
                    <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">
                      {field.label.replace(/ ?ID$/, '')}
                    </dt>
                    <dd className="text-sm text-zinc-800">
                      {name
                        ? <Link href={`/accounts/${id}`} className="text-blue-600 hover:underline">{name}</Link>
                        : id || '—'
                      }
                    </dd>
                  </div>
                )
              }

              // contact_id フィールド → 担当者リンク
              if (contactIdApiNames.has(field.api_name)) {
                const id = String(val ?? '').trim()
                const name = id ? contactMap.get(id) : null
                return (
                  <div key={field.id}>
                    <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">
                      {field.label.replace(/ ?ID$/, '')}
                    </dt>
                    <dd className="text-sm text-zinc-800">
                      {name
                        ? <Link href={`/contacts/${id}`} className="text-blue-600 hover:underline">{name}</Link>
                        : id || '—'
                      }
                    </dd>
                  </div>
                )
              }

              // formula フィールド → 数式を評価して表示
              if (field.field_type === 'formula') {
                const expr = field.options ?? ''
                const computed = evalFormula(expr, data)
                return (
                  <div key={field.id}>
                    <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">
                      {field.label}
                      <span className="ml-1.5 text-violet-400 normal-case font-normal">数式</span>
                    </dt>
                    <dd className="text-sm text-zinc-800">
                      {computed !== '' ? Number(computed).toLocaleString('ja-JP') : '—'}
                    </dd>
                  </div>
                )
              }

              return (
                <div key={field.id} className={field.field_type === 'textarea' ? 'col-span-full' : ''}>
                  <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">
                    {field.label}
                  </dt>
                  <dd className="text-sm text-zinc-800">
                    {formatDetailValue(field.field_type, val)}
                  </dd>
                </div>
              )
            })}
          </dl>
        )}

        <div className="mt-6 pt-4 border-t border-zinc-100 flex gap-6 text-xs text-zinc-400">
          <span>作成: {record.created_at ? new Date(record.created_at).toLocaleString('ja-JP') : '—'}</span>
          <span>更新: {record.updated_at ? new Date(record.updated_at).toLocaleString('ja-JP') : '—'}</span>
        </div>
      </div>

      {/* 関係性（多対多） */}
      <RelatedRecordsSection
        objectType={objectApiName}
        recordId={recordId}
        pagePath={`/objects/${objectApiName}/${recordId}`}
      />
    </div>
  )
}

function formatDetailValue(fieldType: string, value: unknown): React.ReactNode {
  if (value == null || value === '') return '—'
  switch (fieldType) {
    case 'boolean': return value ? 'はい' : 'いいえ'
    case 'number':  return Number(value).toLocaleString('ja-JP')
    case 'date':    return new Date(String(value)).toLocaleDateString('ja-JP')
    default:        return String(value)
  }
}
