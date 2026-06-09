import { db } from '@/lib/db'
import { accounts, contacts } from '@/lib/schema'
import { properties } from '@/industries/real-estate/schema'
import { desc, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ListViewToolbar from '@/components/ListViewToolbar'
import { type FieldDef } from '@/components/FilterBuilder'
import { parseFilterParams, applyFilters } from '@/lib/filterUtils'
import { parseSortParams, applySort } from '@/lib/sortUtils'
import CsvToolbar from '@/components/CsvToolbar'
import Pagination from '@/components/Pagination'
import { canEdit, getCurrentUserId } from '@/lib/auth'
import { getListViewColumns } from '@/lib/listViewSettings'
import { getDefaultView } from '@/lib/savedViews'
import PropertiesTableView from '@/industries/real-estate/components/tableviews/PropertiesTableView'
import SavedViewsPanel from '@/components/SavedViewsPanel'
import TableErrorBoundary from '@/components/TableErrorBoundary'
import MobileGroupedCards from '@/components/MobileGroupedCards'
import { NavIcon } from '@/lib/navIcon'

const PAGE_SIZE = 20

const STATUS_COLORS: Record<string, string> = {
  '募集中': 'bg-blue-100 text-blue-700',
  '提案中': 'bg-blue-100 text-blue-700',
  '交渉中': 'bg-yellow-100 text-yellow-700',
  '成約':   'bg-green-100 text-green-700',
  '管理中': 'bg-purple-100 text-purple-700',
  '終了':   'bg-zinc-100 text-zinc-500',
}

const TX_COLORS: Record<string, string> = {
  '売買':       'bg-orange-50 text-orange-700',
  '賃貸':       'bg-cyan-50 text-cyan-700',
  'サービス提供': 'bg-purple-50 text-purple-700',
  'その他':     'bg-zinc-100 text-zinc-600',
}

const FIELDS_RE: FieldDef[] = [
  { value: 'name',    label: '物件名',   type: 'text' },
  { value: 'address', label: '所在地',   type: 'text' },
  {
    value: 'property_type', label: '物件種別', type: 'select',
    options: ['土地・建物','建物のみ','土地のみ','その他'].map((v) => ({ value: v, label: v })),
  },
  {
    value: 'transaction_type', label: '取引種別', type: 'select',
    options: [{ value: '売買', label: '売買' }, { value: '賃貸', label: '賃貸' }],
  },
  {
    value: 'status', label: 'ステータス', type: 'select',
    options: ['募集中','交渉中','成約','管理中','終了'].map((v) => ({ value: v, label: v })),
  },
  { value: 'price', label: '価格（円）', type: 'number' },
  { value: 'area',  label: '面積（㎡）', type: 'number' },
]

const FIELDS_OTHER: FieldDef[] = [
  { value: 'name', label: '件名', type: 'text' },
  {
    value: 'transaction_type', label: '取引種別', type: 'select',
    options: ['売買','賃貸','サービス提供','その他'].map((v) => ({ value: v, label: v })),
  },
  {
    value: 'status', label: 'ステータス', type: 'select',
    options: ['提案中','交渉中','成約','終了'].map((v) => ({ value: v, label: v })),
  },
  { value: 'price', label: '金額（円）', type: 'number' },
]

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[]; page?: string; view?: string; group?: string; sort?: string }>
}) {
  // パフォーマンス最適化: getDefaultView を Round 1 と並列化
  const userIdPromise = getCurrentUserId()
  const dvPromise     = userIdPromise.then((uid) => uid ? getDefaultView('properties', uid) : null)
  const [sp, edit, colConfig, userId, dv] = await Promise.all([
    searchParams, canEdit(), getListViewColumns('properties'), userIdPromise, dvPromise,
  ])
  const view      = sp.view === 'other' ? 'other' : 'real_estate'
  const filterRaw = [sp.f].flat().filter(Boolean) as string[]
  const page      = Math.max(1, parseInt(sp.page ?? '1', 10))
  const groupBy   = (sp.group ?? '').split(',').filter(Boolean)
  const isGrouped = groupBy.length > 0

  if (filterRaw.length === 0 && groupBy.length === 0) {
    if (dv && (dv.filter_params.length > 0 || dv.group_params)) {
      const p = new URLSearchParams({ view })
      dv.filter_params.forEach((f) => p.append('f', f))
      if (dv.group_params) p.set('group', dv.group_params)
      if (dv.sort_params) p.set('sort', dv.sort_params)
      redirect(`/properties?${p.toString()}`)
    }
  }
  const conditions = parseFilterParams(filterRaw)

  const raw = await db.select({
    id:               properties.id,
    product_category: properties.product_category,
    name:             properties.name,
    property_type:    properties.property_type,
    transaction_type: properties.transaction_type,
    status:           properties.status,
    address:          properties.address,
    area:             properties.area,
    price:            properties.price,
    accounts: { id: accounts.id, name: accounts.name },
    contacts: { id: contacts.id, full_name: contacts.full_name },
  })
    .from(properties)
    .leftJoin(accounts, eq(properties.account_id, accounts.id))
    .leftJoin(contacts, eq(properties.contact_id, contacts.id))
    .where(eq(properties.product_category, view))
    .orderBy(desc(properties.created_at))

  const list       = applyFilters(raw as Record<string, unknown>[], conditions)
  const sortRaw    = sp.sort ?? ''
  const sorted     = applySort(list as Record<string, unknown>[], parseSortParams(sortRaw))
  const hasFilter  = conditions.length > 0
  const totalCount = sorted.length
  const totalPages = isGrouped ? 1 : Math.ceil(totalCount / PAGE_SIZE)
  const displayList = isGrouped
    ? sorted
    : sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const isRE    = view === 'real_estate'
  const FIELDS  = isRE ? FIELDS_RE : FIELDS_OTHER
  const newHref = `/properties/new?view=${view}`

  const groupableFields = FIELDS.map((f) => ({ key: f.value, label: f.label }))

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">物件・商品</h1>
          <p className="text-sm text-zinc-500 mt-1">
            全 {totalCount} 件{hasFilter && <span className="ml-1 text-blue-600">（絞り込み中）</span>}
            {isGrouped && <span className="ml-1 text-violet-600">（グルーピング中）</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CsvToolbar
            exportUrl="/api/export/properties"
            importUrl="/api/import/properties"
            label="物件・商品"
            csvFormat="ID,カテゴリ,件名,物件種別,取引種別,ステータス,価格(円),取引先名,担当者名,土地不動産番号,土地所在,地番,地目,地積(㎡),原因及びその日付,土地現所有者名,土地所有者住所,土地所有権取得原因,土地所有権取得日,土地差押有無,土地直近差押解除日,建物不動産番号,建物所在,家屋番号,種類,構造,床面積1階(㎡),床面積2階(㎡),床面積3階(㎡),新築年月日,建物現所有者名,建物所有者住所,建物所有権取得原因,建物所有権取得日,建物差押有無,建物直近差押解除日,登記種別,権利者名,債権額(円),損害金率(%),共同担保目録番号,備考"
            fieldOptions={{
              'カテゴリ': ['不動産', 'その他商品'],
              '物件種別': ['土地・建物', '建物のみ', '土地のみ', 'その他'],
              '取引種別': ['売買', '賃貸', 'サービス提供', 'その他'],
              'ステータス': ['募集中', '交渉中', '成約', '管理中', '終了', '提案中'],
              '土地差押有無': ['1（あり）', '空（なし）'],
              '建物差押有無': ['1（あり）', '空（なし）'],
            }}
            showImport={edit}
          />
          {edit && (
            <Link
              href={newHref}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              ＋ 新規登録
            </Link>
          )}
        </div>
      </div>

      {/* タブ */}
      <div className="flex gap-1 mb-4 border-b border-zinc-200">
        {[
          { value: 'real_estate', label: '不動産' },
          { value: 'other',       label: 'その他商品' },
        ].map(({ value, label }) => (
          <Link
            key={value}
            href={`/properties?view=${value}`}
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
        objectType="properties"
        basePath="/properties"
        currentFilterRaw={filterRaw}
        currentGroup={sp.group ?? ''}
        currentSort={sortRaw}
        persistParams={{ view }}
      />
      <ListViewToolbar
        fields={FIELDS}
        initialFilters={filterRaw}
        basePath="/properties"
        groupableFields={groupableFields}
        initialGroup={sp.group ?? ''}
        persistParams={{ view }}
      />

      {totalCount === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <div className="flex justify-center mb-4"><NavIcon icon={isRE ? '🏠' : '📦'} className="w-12 h-12 text-zinc-300" /></div>
          <p className="text-lg font-medium">
            {hasFilter
              ? `条件に一致する${isRE ? '物件' : '商品'}がありません`
              : `${isRE ? '物件' : '商品'}がまだありません`}
          </p>
          {hasFilter
            ? <Link href={`/properties?view=${view}`} className="text-sm text-blue-600 hover:underline mt-1 block">絞り込みをクリア</Link>
            : <p className="text-sm mt-1">「新規登録」ボタンから追加してください</p>
          }
        </div>
      ) : (
        <>
          {/* PC: 動的テーブル（グルーピング対応） */}
          <div className="hidden md:block">
            <TableErrorBoundary>
              <PropertiesTableView
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
                const p = rec as typeof raw[0]
                const account = p.accounts?.id ? p.accounts : null
                return (
                  <Link href={`/properties/${p.id}`} className="block bg-white rounded-lg border border-zinc-200 px-4 py-3 hover:border-zinc-300 active:bg-zinc-50">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-zinc-900 text-sm leading-snug">{p.name}</span>
                      <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                        {p.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
                      {isRE && <span className="text-xs text-zinc-500">{p.property_type}</span>}
                      <span className={`text-xs px-1.5 py-0 rounded font-medium ${TX_COLORS[p.transaction_type] ?? ''}`}>{p.transaction_type}</span>
                    </div>
                    {isRE && p.address && <p className="text-xs text-zinc-400 mt-1 truncate inline-flex items-center gap-1"><NavIcon icon="📍" className="w-3 h-3 shrink-0" />{p.address}</p>}
                    {account && <p className="text-xs text-zinc-400 mt-0.5 inline-flex items-center gap-1"><NavIcon icon="🏢" className="w-3 h-3 shrink-0" />{account.name}</p>}
                    <div className="flex items-center justify-between mt-1.5 text-xs text-zinc-500">
                      <span>{isRE && p.area ? `${Number(p.area).toLocaleString()} ㎡` : ''}</span>
                      {p.price && <span className="font-semibold text-zinc-800">¥{Number(p.price).toLocaleString()}</span>}
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
          basePath="/properties"
          filterParams={filterRaw}
          extraParams={{ view }}
        />
      )}
    </div>
  )
}
