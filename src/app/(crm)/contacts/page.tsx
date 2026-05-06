import { db } from '@/lib/db'
import { contacts, accounts, tags, taggables } from '@/lib/schema'
import { desc, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ListViewToolbar from '@/components/ListViewToolbar'
import { type FieldDef } from '@/components/FilterBuilder'
import { parseFilterParams, applyFilters, splitTagConditions, applyTagFilter } from '@/lib/filterUtils'
import { parseSortParams, applySort } from '@/lib/sortUtils'
import CsvToolbar from '@/components/CsvToolbar'
import TextImportModal from '@/components/TextImportModal'
import Pagination from '@/components/Pagination'
import { canEdit, getCurrentUserId } from '@/lib/auth'
import { getListViewColumns } from '@/lib/listViewSettings'
import { getDefaultView } from '@/lib/savedViews'
import ContactsTableView from '@/components/tableviews/ContactsTableView'
import SavedViewsPanel from '@/components/SavedViewsPanel'
import TableErrorBoundary from '@/components/TableErrorBoundary'

const PAGE_SIZE = 20

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[]; page?: string; view?: string; group?: string; sort?: string }>
}) {
  const [sp, edit, colConfig, userId] = await Promise.all([searchParams, canEdit(), getListViewColumns('contacts'), getCurrentUserId()])
  const view       = (sp.view === 'consumer') ? 'consumer' : 'business'
  const filterRaw  = [sp.f].flat().filter(Boolean) as string[]
  const page       = Math.max(1, parseInt(sp.page ?? '1', 10))
  const groupBy    = (sp.group ?? '').split(',').filter(Boolean)
  const isGrouped  = groupBy.length > 0

  // デフォルトビュー適用
  if (filterRaw.length === 0 && groupBy.length === 0) {
    const dv = await getDefaultView('contacts', userId)
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

  const [raw, allTags, taggableRows] = await Promise.all([
    db.select({
      id:           contacts.id,
      contact_type: contacts.contact_type,
      full_name:    contacts.full_name,
      email:        contacts.email,
      phone:        contacts.phone,
      title:        contacts.title,
      department:   contacts.department,
      birthday:     contacts.birthday,
      account_id:   contacts.account_id,
      accounts: {
        id:   accounts.id,
        name: accounts.name,
      },
    })
      .from(contacts)
      .leftJoin(accounts, eq(contacts.account_id, accounts.id))
      .where(eq(contacts.contact_type, view))
      .orderBy(desc(contacts.created_at)),
    db.select({ id: tags.id, name: tags.name, color: tags.color }).from(tags).orderBy(tags.name),
    tagConditions.length > 0
      ? db.select({ tag_id: taggables.tag_id, object_id: taggables.object_id })
          .from(taggables).where(eq(taggables.object_type, 'contact'))
      : Promise.resolve([]),
  ])

  const taggedIdsByTagId = new Map<string, Set<string>>()
  for (const t of taggableRows) {
    if (!taggedIdsByTagId.has(t.tag_id)) taggedIdsByTagId.set(t.tag_id, new Set())
    taggedIdsByTagId.get(t.tag_id)!.add(t.object_id)
  }

  const FIELDS_BUSINESS: FieldDef[] = [
    { value: 'full_name',     label: '氏名',   type: 'text' },
    { value: 'email',         label: 'メール', type: 'text' },
    { value: 'title',         label: '役職',   type: 'text' },
    { value: 'department',    label: '部署',   type: 'text' },
    { value: 'accounts.name', label: '取引先', type: 'text' },
    { value: 'tag', label: 'タグ', type: 'select', options: allTags.map((t) => ({ value: t.id, label: t.name })) },
  ]
  const FIELDS_CONSUMER: FieldDef[] = [
    { value: 'full_name', label: '氏名',   type: 'text' },
    { value: 'email',     label: 'メール', type: 'text' },
    { value: 'phone',     label: '電話',   type: 'text' },
    { value: 'tag', label: 'タグ', type: 'select', options: allTags.map((t) => ({ value: t.id, label: t.name })) },
  ]
  const FIELDS = view === 'business' ? FIELDS_BUSINESS : FIELDS_CONSUMER

  let contactsList = applyFilters(raw as Record<string, unknown>[], otherConditions)
  contactsList     = applyTagFilter(contactsList, tagConditions, taggedIdsByTagId)
  const sortRaw    = sp.sort ?? ''
  const sorted     = applySort(contactsList as Record<string, unknown>[], parseSortParams(sortRaw))
  const hasFilter  = conditions.length > 0
  const totalCount = sorted.length
  const totalPages = isGrouped ? 1 : Math.ceil(totalCount / PAGE_SIZE)
  const displayList = isGrouped
    ? sorted
    : sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const mobileList = isGrouped ? sorted.slice(0, PAGE_SIZE) : displayList

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
          <p className="text-4xl mb-4">{isBiz ? '👔' : '👤'}</p>
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
          {/* モバイル: カード */}
          <div className="md:hidden space-y-2">
            {isGrouped && (
              <p className="text-xs text-zinc-500 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2">
                📊 グルーピング表示はPC版でご確認ください（先頭 {PAGE_SIZE} 件を表示中）
              </p>
            )}
            {(mobileList as typeof raw).map((c) => {
              const account = c.accounts?.id ? c.accounts : null
              return (
                <Link key={c.id} href={`/contacts/${c.id}`} className="block bg-white rounded-lg border border-zinc-200 px-4 py-3 hover:border-zinc-300 active:bg-zinc-50">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-zinc-900 text-sm">{isBiz ? '👔' : '👤'} {c.full_name}</span>
                    {isBiz && c.title && <span className="shrink-0 text-xs text-zinc-500">{c.title}</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-zinc-500">
                    {isBiz && account && <span>🏢 {account.name}</span>}
                    {isBiz && c.department && <span>{c.department}</span>}
                    {c.email && <span>✉️ {c.email}</span>}
                    {c.phone && <span>📞 {c.phone}</span>}
                  </div>
                </Link>
              )
            })}
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
