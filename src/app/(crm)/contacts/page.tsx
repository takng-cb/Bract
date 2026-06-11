import { db } from '@/lib/db'
import { contacts, accounts, taggables } from '@/lib/schema'
import { getAllTags } from '@/lib/tagUtils'
import { getAllUsers } from '@/lib/userUtils'
import { desc, eq, and, inArray, count } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ListViewToolbar from '@/components/ListViewToolbar'
import { type FieldDef } from '@/components/FilterBuilder'
import {
  parseFilterParams, applyFilters, splitTagConditions, applyTagFilter,
  buildWhere, buildTagWhere, unresolvedConditions,
  type FilterColumnResolver,
} from '@/lib/filterUtils'
import { parseSortParams, applySort, buildOrderBy } from '@/lib/sortUtils'
import CsvToolbar from '@/components/CsvToolbar'
import TextImportModal from '@/components/TextImportModal'
import Pagination from '@/components/Pagination'
import { canEdit, getCurrentUserId } from '@/lib/auth'
import { getListViewColumns } from '@/lib/listViewSettings'
import { getDefaultView } from '@/lib/savedViews'
import ContactsTableView from '@/components/tableviews/ContactsTableView'
import SavedViewsPanel from '@/components/SavedViewsPanel'
import TableErrorBoundary from '@/components/TableErrorBoundary'
import MobileGroupedCards from '@/components/MobileGroupedCards'
import { NavIcon } from '@/lib/navIcon'
import { requireBookRead } from '@/lib/permissions'

const PAGE_SIZE = 20

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[]; page?: string; view?: string; group?: string; sort?: string }>
}) {
  await requireBookRead('contacts')  // RBAC: Read 権限ガード（ADR-0023）
  // パフォーマンス最適化: getDefaultView を Round 1 と並列化
  const userIdPromise = getCurrentUserId()
  const dvPromise     = userIdPromise.then((uid) => uid ? getDefaultView('contacts', uid) : null)
  const [sp, edit, colConfig, _userId, dv] = await Promise.all([
    searchParams, canEdit(), getListViewColumns('contacts'), userIdPromise, dvPromise,
  ])
  const view       = (sp.view === 'consumer') ? 'consumer' : 'business'
  const filterRaw  = [sp.f].flat().filter(Boolean) as string[]
  const page       = Math.max(1, parseInt(sp.page ?? '1', 10))
  const groupBy    = (sp.group ?? '').split(',').filter(Boolean)
  const isGrouped  = groupBy.length > 0

  // デフォルトビュー適用
  if (filterRaw.length === 0 && groupBy.length === 0) {
    if (dv && (dv.filter_params.length > 0 || dv.group_params)) {
      const p = new URLSearchParams({ view })
      dv.filter_params.forEach((f) => p.append('f', f))
      if (dv.group_params) p.set('group', dv.group_params)
      if (dv.sort_params) p.set('sort', dv.sort_params)
      redirect(`/contacts?${p.toString()}`)
    }
  }
  const conditions = parseFilterParams(filterRaw)
  const { tagConditions, otherConditions } = splitTagConditions(conditions)
  const sortRaw  = sp.sort ?? ''
  const sortDefs = parseSortParams(sortRaw)

  const selectShape = {
    id:           contacts.id,
    contact_type: contacts.contact_type,
    full_name:    contacts.full_name,
    email:        contacts.email,
    phone:        contacts.phone,
    title:        contacts.title,
    department:   contacts.department,
    birthday:     contacts.birthday,
    account_id:   contacts.account_id,
    owner_id:     contacts.owner_id,
    accounts: {
      id:   accounts.id,
      name: accounts.name,
    },
  } as const

  const _typeProbe = () => db.select(selectShape)
    .from(contacts)
    .leftJoin(accounts, eq(contacts.account_id, accounts.id))
  type SelectRow = Awaited<ReturnType<typeof _typeProbe>>[number]

  const resolver: FilterColumnResolver = {
    full_name:       { col: contacts.full_name,  type: 'text' },
    email:           { col: contacts.email,      type: 'text' },
    phone:           { col: contacts.phone,      type: 'text' },
    title:           { col: contacts.title,      type: 'text' },
    department:      { col: contacts.department, type: 'text' },
    'accounts.name': { col: accounts.name,       type: 'text' },
    owner_id:        { col: contacts.owner_id,   type: 'select' },
  }

  // tag フィルタは buildTagWhere で SQL 化。resolver で解決できない条件のみ JS フォールバック。
  const useJsFallback = unresolvedConditions(otherConditions, resolver).length > 0
  // 法人/個人 切替は SQL/JS 両方で適用
  const viewWhere = eq(contacts.contact_type, view)

  let displayList: SelectRow[]
  let totalCount: number
  let allTags: Awaited<ReturnType<typeof getAllTags>>
  let allUsers: Awaited<ReturnType<typeof getAllUsers>>

  if (useJsFallback) {
    const [raw, tags, taggableRows, users] = await Promise.all([
      _typeProbe()
        .where(viewWhere)
        .orderBy(desc(contacts.created_at)),
      getAllTags(),
      tagConditions.length > 0
        ? db.select({ tag_id: taggables.tag_id, object_id: taggables.object_id })
            .from(taggables).where(and(
              eq(taggables.object_type, 'contact'),
              inArray(taggables.tag_id, tagConditions.map((c) => c.value)),
            ))
        : Promise.resolve([] as { tag_id: string; object_id: string }[]),
      getAllUsers(),
    ])
    allTags  = tags
    allUsers = users

    const taggedIdsByTagId = new Map<string, Set<string>>()
    for (const t of taggableRows) {
      if (!taggedIdsByTagId.has(t.tag_id)) taggedIdsByTagId.set(t.tag_id, new Set())
      taggedIdsByTagId.get(t.tag_id)!.add(t.object_id)
    }

    let list = applyFilters(raw as Record<string, unknown>[], otherConditions) as SelectRow[]
    list = applyTagFilter(list, tagConditions, taggedIdsByTagId)
    const sorted = applySort(list as Record<string, unknown>[], sortDefs) as SelectRow[]
    totalCount = sorted.length
    displayList = isGrouped ? sorted : sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  } else {
    const userWhere = buildWhere(otherConditions, resolver)
    const tagWhere = buildTagWhere(tagConditions, 'contact', contacts.id)
    const where = and(viewWhere, userWhere, tagWhere)
    const orderBy = buildOrderBy(sortDefs, resolver)
    const finalOrderBy = orderBy.length > 0 ? orderBy : [desc(contacts.created_at)]

    const baseQuery = db.select(selectShape)
      .from(contacts)
      .leftJoin(accounts, eq(contacts.account_id, accounts.id))
      .where(where)
      .orderBy(...finalOrderBy)

    const [pageRows, totalRow, tags, users] = await Promise.all([
      isGrouped ? baseQuery : baseQuery.limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
      db.select({ count: count() })
        .from(contacts)
        .leftJoin(accounts, eq(contacts.account_id, accounts.id))
        .where(where),
      getAllTags(),
      getAllUsers(),
    ])
    allTags  = tags
    allUsers = users
    totalCount  = Number(totalRow[0]?.count ?? 0)
    displayList = pageRows
  }

  const FIELDS_BUSINESS: FieldDef[] = [
    { value: 'full_name',     label: '氏名',   type: 'text' },
    { value: 'email',         label: 'メール', type: 'text' },
    { value: 'title',         label: '役職',   type: 'text' },
    { value: 'department',    label: '部署',   type: 'text' },
    { value: 'accounts.name', label: '取引先', type: 'text' },
    { value: 'owner_id', label: '担当者', type: 'select', options: allUsers.map((u) => ({ value: u.id, label: u.name })) },
    { value: 'tag', label: 'タグ', type: 'select', options: allTags.map((t) => ({ value: t.id, label: t.name })) },
  ]
  const FIELDS_CONSUMER: FieldDef[] = [
    { value: 'full_name', label: '氏名',   type: 'text' },
    { value: 'email',     label: 'メール', type: 'text' },
    { value: 'phone',     label: '電話',   type: 'text' },
    { value: 'owner_id', label: '担当者', type: 'select', options: allUsers.map((u) => ({ value: u.id, label: u.name })) },
    { value: 'tag', label: 'タグ', type: 'select', options: allTags.map((t) => ({ value: t.id, label: t.name })) },
  ]
  const FIELDS = view === 'business' ? FIELDS_BUSINESS : FIELDS_CONSUMER

  const hasFilter  = conditions.length > 0
  const totalPages = isGrouped ? 1 : Math.ceil(totalCount / PAGE_SIZE)

  const groupableFields = FIELDS
    .filter((f) => f.value !== 'tag')
    .map((f) => ({ key: f.value, label: f.label }))

  const tabBase  = (v: string) => `/contacts?view=${v}`
  const newHref  = `/contacts/new?view=${view}`
  const isBiz    = view === 'business'

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">人物</h1>
          <p className="text-sm text-zinc-500 mt-1">
            全 {totalCount} 件{hasFilter && <span className="ml-1 text-blue-600">（絞り込み中）</span>}
            {isGrouped && <span className="ml-1 text-violet-600">（グルーピング中）</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CsvToolbar
            exportUrl="/api/export/contacts"
            importUrl="/api/import/contacts"
            label="人物"
            csvFormat="ID,氏名,役職,部署,メール,電話番号,誕生日,取引先名,メモ"
            showImport={edit}
          />
          {edit && (
            <TextImportModal
              importUrl="/api/import/business-cards"
              title="名刺インポート"
              buttonLabel="名刺インポート"
              csvFormat="会社名,種別,業種,電話番号(会社),Webサイト,住所,氏名,役職,部署,メール,電話番号(個人)"
              fieldOptions={{
                '種別': ['顧客', '見込み客', 'パートナー', '競合他社', 'その他'],
                '業種': ['IT・ソフトウェア', '製造業', '商社', '金融・保険', '医療・ヘルスケア', '広告・マーケティング', '小売・EC', '食品・飲料', 'エネルギー', '教育', '不動産', '弁護士', '司法書士', '税理士', '行政書士', 'その他'],
              }}
            />
          )}
          {edit && (
            <Link
              href={newHref}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              ＋ 新規作成
            </Link>
          )}
        </div>
      </div>

      {/* タブ */}
      <div className="flex gap-1 mb-4 border-b border-zinc-200">
        {[
          { value: 'business', label: '法人担当（ToB）' },
          { value: 'consumer', label: '個人顧客（ToC）' },
        ].map(({ value, label }) => (
          <Link
            key={value}
            href={tabBase(value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              view === value
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <SavedViewsPanel
        objectType="contacts"
        basePath="/contacts"
        currentFilterRaw={filterRaw}
        currentGroup={sp.group ?? ''}
        currentSort={sortRaw}
        persistParams={{ view }}
      />
      <ListViewToolbar
        fields={FIELDS}
        initialFilters={filterRaw}
        basePath="/contacts"
        groupableFields={groupableFields}
        initialGroup={sp.group ?? ''}
        persistParams={{ view }}
      />

      {totalCount === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <div className="flex justify-center mb-4"><NavIcon icon={isBiz ? '👔' : '👤'} className="w-12 h-12 text-zinc-300" /></div>
          <p className="text-lg font-medium">
            {hasFilter
              ? `条件に一致する${isBiz ? '法人担当者' : '個人顧客'}がいません`
              : `${isBiz ? '法人担当者' : '個人顧客'}がまだいません`}
          </p>
          {hasFilter
            ? <Link href={tabBase(view)} className="text-sm text-blue-600 hover:underline mt-1 block">絞り込みをクリア</Link>
            : <p className="text-sm mt-1">「新規作成」ボタンから追加してください</p>
          }
        </div>
      ) : (
        <>
          {/* PC: 動的テーブル（グルーピング対応） */}
          <div className="hidden md:block">
            <TableErrorBoundary>
              <ContactsTableView
                records={displayList}
                groupBy={groupBy}
                fields={FIELDS}
                activeKeys={colConfig}
                currentSortStr={sortRaw}
              />
            </TableErrorBoundary>
          </div>
          {/* モバイル: カード（グルーピング対応） */}
          <div className="md:hidden">
            <MobileGroupedCards
              records={displayList}
              groupBy={groupBy}
              fields={FIELDS}
              renderCard={(rec) => {
                const c = rec as SelectRow
                const account = c.accounts?.id ? c.accounts : null
                return (
                  <Link href={`/contacts/${c.id}`} className="block bg-white rounded-lg border border-zinc-200 px-4 py-3 hover:border-zinc-300 active:bg-zinc-50">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-zinc-900 text-sm inline-flex items-center gap-1"><NavIcon icon={isBiz ? '👔' : '👤'} className="w-3.5 h-3.5 shrink-0" />{c.full_name}</span>
                      {isBiz && c.title && <span className="shrink-0 text-xs text-zinc-500">{c.title}</span>}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-zinc-500">
                      {isBiz && account && <span className="inline-flex items-center gap-1"><NavIcon icon="🏢" className="w-3 h-3 shrink-0" />{account.name}</span>}
                      {isBiz && c.department && <span>{c.department}</span>}
                      {c.email && <span className="inline-flex items-center gap-1"><NavIcon icon="✉️" className="w-3 h-3 shrink-0" />{c.email}</span>}
                      {c.phone && <span className="inline-flex items-center gap-1"><NavIcon icon="📞" className="w-3 h-3 shrink-0" />{c.phone}</span>}
                    </div>
                  </Link>
                )
              }}
            />
          </div>
        </>
      )}

      {!isGrouped && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          basePath="/contacts"
          filterParams={filterRaw}
          extraParams={{ view }}
        />
      )}
    </div>
  )
}
