import { getBookDef, getFieldDefs } from '@/lib/bookMetadata'
import { db } from '@/lib/db'
import { book_records, accounts, contacts } from '@/lib/schema'
import { eq, desc, inArray, and, count } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { canEdit, getCurrentUserId } from '@/lib/auth'
import CsvToolbar from '@/components/CsvToolbar'
import ListViewToolbar from '@/components/ListViewToolbar'
import SavedViewsPanel from '@/components/SavedViewsPanel'
import MobileGroupedCards from '@/components/MobileGroupedCards'
import Pagination from '@/components/Pagination'
import CustomObjectTableView, { type SerializedFieldDef } from '@/components/tableviews/CustomObjectTableView'
import { parseFilterParams } from '@/lib/filterUtils'
import { parseSortParams } from '@/lib/sortUtils'
import type { FieldDef } from '@/components/FilterBuilder'
import { parseFieldOptions } from '@/lib/bookMetadata'
import { getDefaultView } from '@/lib/savedViews'
import { buildJsonbWhere, buildJsonbOrderBy } from '@/lib/jsonbFilterUtils'
import { requireBookRead } from '@/lib/permissions'

const PAGE_SIZE = 20

// book_fields の field_type → FilterBuilder の FieldType に変換
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
  await requireBookRead(objectApiName)  // RBAC: Read 権限ガード（ADR-0023）

  // ── Round 1: オブジェクト定義・フィールド定義・デフォルトビューを並列取得 ──
  // パフォーマンス最適化: getDefaultView を Round 1 に含めて RTT 削減
  const userIdPromise = getCurrentUserId()
  const dvPromise     = userIdPromise.then((uid) => uid ? getDefaultView(objectApiName, uid) : null)
  const [obj, edit, _userId, dv] = await Promise.all([
    getBookDef(objectApiName),
    canEdit(),
    userIdPromise,
    dvPromise,
  ])
  if (!obj) notFound()

  const fields = await getFieldDefs(obj.id)
  const dataFields = fields.filter((f) => f.is_visible && f.field_type !== 'section')

  // フィールド名 → type のマップ（SQL フィルタ・ソートに使用）
  const fieldTypeMap = new Map(dataFields.map((f) => [f.api_name, f.field_type]))

  // account_id / contact_id フィールドの特定
  const accountIdApiNames = new Set(
    dataFields.filter((f) => f.api_name === 'account_id' || f.api_name.endsWith('_account_id')).map((f) => f.api_name)
  )
  const contactIdApiNames = new Set(
    dataFields.filter((f) => f.api_name === 'contact_id' || f.api_name.endsWith('_contact_id')).map((f) => f.api_name)
  )

  // ── URL パラメータ解析 ──
  const filterRawRaw = [sp.f].flat().filter(Boolean) as string[]

  // デフォルトビュー適用 (Round 1 で並列取得済み)
  if (filterRawRaw.length === 0 && !sp.group && !sp.sort) {
    if (dv && (dv.filter_params.length > 0 || dv.group_params || dv.sort_params)) {
      const p = new URLSearchParams()
      dv.filter_params.forEach((f) => p.append('f', f))
      if (dv.group_params) p.set('group', dv.group_params)
      if (dv.sort_params)  p.set('sort', dv.sort_params)
      redirect(`/books/${objectApiName}?${p.toString()}`)
    }
  }

  const filterRaw = filterRawRaw
  const groupBy   = (sp.group ?? '').split(',').filter(Boolean)
  const sortStr   = sp.sort ?? ''
  const page      = Math.max(1, parseInt(sp.page ?? '1', 10))
  const isGrouped = groupBy.length > 0

  // ── SQL フィルタ・ソート構築 ──
  const conditions  = parseFilterParams(filterRaw)
  const sortDefs    = parseSortParams(sortStr)
  const filterWhere = buildJsonbWhere(conditions, fieldTypeMap)
  const orderByClauses = buildJsonbOrderBy(sortDefs, fieldTypeMap)
  const hasFilter   = conditions.length > 0

  // 基本 WHERE: このオブジェクトのレコード + フィルタ条件
  const baseWhere = filterWhere
    ? and(eq(book_records.object_id, obj.id), filterWhere)
    : eq(book_records.object_id, obj.id)

  // デフォルトソート: created_at DESC
  const defaultOrder = desc(book_records.created_at)
  const finalOrder   = orderByClauses.length > 0 ? orderByClauses : [defaultOrder]

  // ── Round 2: レコード取得（グルーピング有無でページング方法を分岐） ──
  let records: (typeof book_records.$inferSelect)[]
  let totalCount: number

  if (isGrouped) {
    // グルーピング時: フィルタ済み全件取得（LIMIT なし）
    const [recs, [{ value: cnt }]] = await Promise.all([
      db.select().from(book_records).where(baseWhere).orderBy(...finalOrder),
      db.select({ value: count() }).from(book_records).where(baseWhere),
    ])
    records    = recs
    totalCount = Number(cnt)
  } else {
    // 通常時: SQL で COUNT + LIMIT/OFFSET
    const [recs, [{ value: cnt }]] = await Promise.all([
      db.select().from(book_records)
        .where(baseWhere)
        .orderBy(...finalOrder)
        .limit(PAGE_SIZE)
        .offset((page - 1) * PAGE_SIZE),
      db.select({ value: count() }).from(book_records).where(baseWhere),
    ])
    records    = recs
    totalCount = Number(cnt)
  }

  // ── account_id / contact_id を一括ルックアップ ──
  const accountIdSet = new Set<string>()
  const contactIdSet = new Set<string>()
  for (const r of records) {
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

  // ── レコードをフラット化（JSONB data を top-level に展開） ──
  const flatRecords = records.map((r) => {
    const extra: Record<string, unknown> = {}
    for (const an of accountIdApiNames) {
      const id = String(r.data[an] ?? '').trim()
      if (id) extra[`__name__${an}`] = accountMap.get(id) ?? ''
    }
    for (const cn of contactIdApiNames) {
      const id = String(r.data[cn] ?? '').trim()
      if (id) extra[`__name__${cn}`] = contactMap.get(id) ?? ''
    }
    return {
      id:         r.id,
      created_at: r.created_at,
      updated_at: r.updated_at,
      ...r.data,
      ...extra,
    } as Record<string, unknown>
  })

  const totalPages = isGrouped ? 1 : Math.ceil(totalCount / PAGE_SIZE)

  // ── FilterBuilder 用フィールド定義 ──
  const filterFields: FieldDef[] = dataFields
    .filter((f) => !accountIdApiNames.has(f.api_name) && !contactIdApiNames.has(f.api_name))
    .map((f): FieldDef => {
      if (f.field_type === 'boolean') {
        return {
          value: f.api_name, label: f.label, type: 'select',
          options: [{ value: 'true', label: 'はい' }, { value: 'false', label: 'いいえ' }],
        }
      }
      if (f.field_type === 'select') {
        const opts = parseFieldOptions(f)
        return {
          value: f.api_name, label: f.label, type: 'select',
          options: opts.map((o) => ({ value: o, label: o })),
        }
      }
      return { value: f.api_name, label: f.label, type: toFilterType(f.field_type) }
    })

  const groupableFields = filterFields
    .filter((f) => f.type !== 'number')
    .map((f) => ({ key: f.value, label: f.label }))

  // ── SerializedFieldDef ──
  const serializedFields: SerializedFieldDef[] = dataFields.map((f) => ({
    api_name:    f.api_name,
    label:       f.label,
    field_type:  f.field_type,
    options:     f.field_type === 'select' ? parseFieldOptions(f) : null,
    formulaExpr: f.field_type === 'formula' ? (f.options ?? null) : null,
  }))

  const csvFormat = ['ID', ...dataFields.map((f) => f.label)].join(',')

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{obj.icon} {obj.label_plural}</h1>
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
            filterFields={filterFields}
          />
          {edit && (
            <Link
              href={`/books/${objectApiName}/new`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              ＋ 新規登録
            </Link>
          )}
        </div>
      </div>

      <SavedViewsPanel
        objectType={objectApiName}
        basePath={`/books/${objectApiName}`}
        currentFilterRaw={filterRaw}
        currentGroup={sp.group ?? ''}
        currentSort={sortStr}
      />

      {filterFields.length > 0 && (
        <ListViewToolbar
          fields={filterFields}
          initialFilters={filterRaw}
          basePath={`/books/${objectApiName}`}
          groupableFields={groupableFields}
          initialGroup={sp.group ?? ''}
        />
      )}

      {totalCount === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <p className="text-4xl mb-4">{obj.icon}</p>
          <p className="text-lg font-medium">
            {hasFilter ? `条件に一致する${obj.label}がありません` : `${obj.label}がまだありません`}
          </p>
          {hasFilter
            ? <Link href={`/books/${objectApiName}`} className="text-sm text-blue-600 hover:underline mt-1 block">絞り込みをクリア</Link>
            : edit && <p className="text-sm mt-1">「新規登録」ボタンから追加してください</p>
          }
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <CustomObjectTableView
              records={flatRecords}
              fields={serializedFields}
              objectApiName={objectApiName}
              groupBy={groupBy}
              filterFields={filterFields}
              currentSortStr={sortStr}
            />
          </div>
          <div className="md:hidden">
            <MobileGroupedCards
              records={flatRecords}
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
                    href={`/books/${objectApiName}/${rec.id}`}
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
          {!isGrouped && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              basePath={`/books/${objectApiName}`}
              filterParams={filterRaw}
            />
          )}
        </>
      )}
    </div>
  )
}
