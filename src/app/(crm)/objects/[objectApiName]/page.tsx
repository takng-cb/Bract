import { getObjectDef, getFieldDefs } from '@/lib/objectMetadata'
import { db } from '@/lib/db'
import { custom_records, accounts, contacts } from '@/lib/schema'
import { eq, desc, inArray } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { canEdit } from '@/lib/auth'
import CsvToolbar from '@/components/CsvToolbar'
import ListViewToolbar from '@/components/ListViewToolbar'
import MobileGroupedCards from '@/components/MobileGroupedCards'
import Pagination from '@/components/Pagination'
import CustomObjectTableView, { type SerializedFieldDef } from '@/components/tableviews/CustomObjectTableView'
import { parseFilterParams, applyFilters } from '@/lib/filterUtils'
import { parseSortParams, applySort } from '@/lib/sortUtils'
import type { FieldDef } from '@/components/FilterBuilder'
import { parseFieldOptions } from '@/lib/objectMetadata'

const PAGE_SIZE = 20

// field_definitions の field_type → FilterBuilder の FieldType に変換
function toFilterType(ft: string): FieldDef['type'] {
  if (ft === 'number')  return 'number'
  if (ft === 'date')    return 'date'
  if (ft === 'select' || ft === 'boolean') return 'select'
  return 'text'
}

export default async function CustomObjectListPage({
  params,
  searchParams,
}: {
  params: Promise<{ objectApiName: string }>
  searchParams: Promise<{ f?: string | string[]; page?: string; group?: string; sort?: string }>
}) {
  const [{ objectApiName }, sp] = await Promise.all([params, searchParams])

  // ── Round 1: オブジェクト定義取得 ──
  const [obj, edit] = await Promise.all([
    getObjectDef(objectApiName),
    canEdit(),
  ])
  if (!obj) notFound()

  // ── Round 2: フィールド定義とレコードを並列取得 ──
  const [fields, records] = await Promise.all([
    getFieldDefs(obj.id),
    db.select()
      .from(custom_records)
      .where(eq(custom_records.object_id, obj.id))
      .orderBy(desc(custom_records.created_at)),
  ])

  const dataFields = fields.filter((f) => f.is_visible && f.field_type !== 'section')

  // ── account_id / contact_id フィールドのリスト ──
  const accountIdApiNames = new Set(
    dataFields.filter((f) => f.api_name === 'account_id' || f.api_name.endsWith('_account_id')).map((f) => f.api_name)
  )
  const contactIdApiNames = new Set(
    dataFields.filter((f) => f.api_name === 'contact_id' || f.api_name.endsWith('_contact_id')).map((f) => f.api_name)
  )

  // ── レコードをフラット化（JSON data を top-level に展開） ──
  const rawFlat = records.map((r) => {
    let data: Record<string, unknown> = {}
    try { data = JSON.parse(r.data) } catch { /* ignore */ }
    return {
      id:         r.id,
      created_at: r.created_at,
      updated_at: r.updated_at,
      ...data,
    } as Record<string, unknown>
  })

  // ── account_id / contact_id を一括ルックアップ ──
  const accountIdSet = new Set<string>()
  const contactIdSet = new Set<string>()
  for (const r of rawFlat) {
    for (const an of accountIdApiNames) {
      const v = String(r[an] ?? '').trim()
      if (v) accountIdSet.add(v)
    }
    for (const cn of contactIdApiNames) {
      const v = String(r[cn] ?? '').trim()
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

  // ── フラットレコードに __name__* キーを追加 ──
  const flatRecords = rawFlat.map((r) => {
    const extra: Record<string, unknown> = {}
    for (const an of accountIdApiNames) {
      const id = String(r[an] ?? '').trim()
      if (id) extra[`__name__${an}`] = accountMap.get(id) ?? ''
    }
    for (const cn of contactIdApiNames) {
      const id = String(r[cn] ?? '').trim()
      if (id) extra[`__name__${cn}`] = contactMap.get(id) ?? ''
    }
    return { ...r, ...extra }
  })

  // ── URL パラメータ解析 ──
  const filterRaw = [sp.f].flat().filter(Boolean) as string[]
  const groupBy   = (sp.group ?? '').split(',').filter(Boolean)
  const sortStr   = sp.sort ?? ''
  const page      = Math.max(1, parseInt(sp.page ?? '1', 10))
  const isGrouped = groupBy.length > 0

  // ── FilterBuilder 用フィールド定義 ──
  const filterFields: FieldDef[] = dataFields
    .filter((f) => !accountIdApiNames.has(f.api_name) && !contactIdApiNames.has(f.api_name))
    .map((f): FieldDef => {
      if (f.field_type === 'boolean') {
        return {
          value: f.api_name,
          label: f.label,
          type: 'select',
          options: [
            { value: 'true',  label: 'はい' },
            { value: 'false', label: 'いいえ' },
          ],
        }
      }
      if (f.field_type === 'select') {
        const opts = parseFieldOptions(f)
        return {
          value: f.api_name,
          label: f.label,
          type: 'select',
          options: opts.map((o) => ({ value: o, label: o })),
        }
      }
      return {
        value: f.api_name,
        label: f.label,
        type: toFilterType(f.field_type),
      }
    })

  // グルーピング対象フィールド（数値・テキストエリア・_id 系を除く）
  const groupableFields = filterFields
    .filter((f) => f.type !== 'number')
    .map((f) => ({ key: f.value, label: f.label }))

  // ── フィルター・ソート適用 ──
  const conditions   = parseFilterParams(filterRaw)
  let   filtered     = applyFilters(flatRecords, conditions)
  const sorted       = applySort(filtered, parseSortParams(sortStr))
  const hasFilter    = conditions.length > 0
  const totalCount   = sorted.length
  const totalPages   = isGrouped ? 1 : Math.ceil(totalCount / PAGE_SIZE)
  const displayList  = isGrouped
    ? sorted
    : sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ── SerializedFieldDef（クライアントコンポーネントへの props） ──
  const serializedFields: SerializedFieldDef[] = dataFields.map((f) => ({
    api_name:   f.api_name,
    label:      f.label,
    field_type: f.field_type,
    options:    f.field_type === 'select' ? parseFieldOptions(f) : null,
  }))

  // CSV インポートのフォーマット文字列
  const csvFormat = ['ID', ...dataFields.map((f) => f.label)].join(',')

  return (
    <div className="p-4 md:p-8">
      {/* ── ヘッダー ── */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">
            {obj.icon} {obj.label_plural}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            全 {totalCount} 件
            {hasFilter && <span className="ml-1 text-blue-600">（絞り込み中）</span>}
            {isGrouped && <span className="ml-1 text-violet-600">（グルーピング中）</span>}
          </p>
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

      {/* ── フィルター・グルーピングツールバー ── */}
      {filterFields.length > 0 && (
        <ListViewToolbar
          fields={filterFields}
          initialFilters={filterRaw}
          basePath={`/objects/${objectApiName}`}
          groupableFields={groupableFields}
          initialGroup={sp.group ?? ''}
        />
      )}

      {/* ── 件数 0 ── */}
      {totalCount === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <p className="text-4xl mb-4">{obj.icon}</p>
          <p className="text-lg font-medium">
            {hasFilter ? `条件に一致する${obj.label}がありません` : `${obj.label}がまだありません`}
          </p>
          {hasFilter
            ? <Link href={`/objects/${objectApiName}`} className="text-sm text-blue-600 hover:underline mt-1 block">絞り込みをクリア</Link>
            : edit && <p className="text-sm mt-1">「新規登録」ボタンから追加してください</p>
          }
        </div>
      ) : (
        <>
          {/* PC: GroupedTable */}
          <div className="hidden md:block">
            <CustomObjectTableView
              records={displayList}
              fields={serializedFields}
              objectApiName={objectApiName}
              groupBy={groupBy}
              filterFields={filterFields}
              currentSortStr={sortStr}
            />
          </div>

          {/* モバイル: カードリスト */}
          <div className="md:hidden">
            <MobileGroupedCards
              records={displayList}
              groupBy={groupBy}
              fields={filterFields}
              renderCard={(rec) => {
                const name = String(rec.name ?? rec.title ?? rec.id ?? '—')
                const sub1 = dataFields.find((f) =>
                  f.api_name !== 'name' && f.api_name !== 'title' && f.field_type !== 'section' && f.field_type !== 'textarea'
                )
                const sub2 = dataFields.find((f) =>
                  f.api_name !== 'name' && f.api_name !== 'title' && f !== sub1 && f.field_type !== 'section' && f.field_type !== 'textarea'
                )
                return (
                  <Link
                    href={`/objects/${objectApiName}/${rec.id}`}
                    className="block bg-white rounded-lg border border-zinc-200 px-4 py-3 hover:border-zinc-300 active:bg-zinc-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-zinc-900 text-sm leading-snug">{name}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-zinc-500">
                      {sub1 && rec[sub1.api_name] != null && rec[sub1.api_name] !== '' && (
                        <span>{String(rec[sub1.api_name])}</span>
                      )}
                      {sub2 && rec[sub2.api_name] != null && rec[sub2.api_name] !== '' && (
                        <span>{String(rec[sub2.api_name])}</span>
                      )}
                    </div>
                  </Link>
                )
              }}
            />
          </div>

          {/* ページネーション */}
          {!isGrouped && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              basePath={`/objects/${objectApiName}`}
              filterParams={filterRaw}
            />
          )}
        </>
      )}
    </div>
  )
}
