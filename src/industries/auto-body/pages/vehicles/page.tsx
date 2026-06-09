import { db } from '@/lib/db'
import { vehicles } from '@/industries/auto-body/schema'
import { accounts } from '@/lib/schema'
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
import VehiclesTableView from '@/industries/auto-body/components/tableviews/VehiclesTableView'
import SavedViewsPanel from '@/components/SavedViewsPanel'
import TableErrorBoundary from '@/components/TableErrorBoundary'
import MobileGroupedCards from '@/components/MobileGroupedCards'
import {
  vehicleStatusColor,
  daysUntilInspection,
  VEHICLE_STATUSES,
} from '@/industries/auto-body/lib/autoBodyService'
import { NavIcon } from '@/lib/navIcon'

const PAGE_SIZE = 20

export default async function VehiclesListPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[]; page?: string; group?: string; sort?: string }>
}) {
  // パフォーマンス最適化: getDefaultView を Round 1 と並列化
  const userIdPromise = getCurrentUserId()
  const dvPromise     = userIdPromise.then((uid) => uid ? getDefaultView('vehicles', uid) : null)
  const [sp, edit, colConfig, userId, dv] = await Promise.all([
    searchParams,
    canEdit(),
    getListViewColumns('vehicles'),
    userIdPromise,
    dvPromise,
  ])

  const filterRaw = [sp.f].flat().filter(Boolean) as string[]
  const page      = Math.max(1, parseInt(sp.page ?? '1', 10))
  const groupBy   = (sp.group ?? '').split(',').filter(Boolean)
  const isGrouped = groupBy.length > 0

  // デフォルトビュー適用（URLにパラメータがない場合のみ）
  if (filterRaw.length === 0 && groupBy.length === 0) {
    if (dv && (dv.filter_params.length > 0 || dv.group_params)) {
      const p = new URLSearchParams()
      dv.filter_params.forEach((f) => p.append('f', f))
      if (dv.group_params) p.set('group', dv.group_params)
      if (dv.sort_params) p.set('sort', dv.sort_params)
      redirect(`/vehicles?${p.toString()}`)
    }
  }

  const conditions = parseFilterParams(filterRaw)
  const sortRaw    = sp.sort ?? ''
  const sortDefs   = parseSortParams(sortRaw)

  const raw = await db.select({
    id:                   vehicles.id,
    maker:                vehicles.maker,
    model:                vehicles.model,
    year:                 vehicles.year,
    mileage:              vehicles.mileage,
    color:                vehicles.color,
    license_plate:        vehicles.license_plate,
    status:               vehicles.status,
    purchase_price:       vehicles.purchase_price,
    sale_price:           vehicles.sale_price,
    sold_price:           vehicles.sold_price,
    next_inspection_date: vehicles.next_inspection_date,
    buyer_account:        { id: accounts.id, name: accounts.name },
  })
    .from(vehicles)
    .leftJoin(accounts, eq(vehicles.buyer_account_id, accounts.id))
    .orderBy(desc(vehicles.created_at))

  const list        = applyFilters(raw as Record<string, unknown>[], conditions)
  const sorted      = applySort(list as Record<string, unknown>[], sortDefs)
  const hasFilter   = conditions.length > 0
  const totalCount  = sorted.length
  const totalPages  = isGrouped ? 1 : Math.ceil(totalCount / PAGE_SIZE)
  const displayList = isGrouped
    ? sorted
    : sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const FIELDS: FieldDef[] = [
    { value: 'maker',         label: 'メーカー',     type: 'text' },
    { value: 'model',         label: '車種',         type: 'text' },
    { value: 'year',          label: '年式',         type: 'number' },
    { value: 'mileage',       label: '走行距離',     type: 'number' },
    { value: 'color',         label: '色',           type: 'text' },
    { value: 'license_plate', label: 'ナンバー',     type: 'text' },
    {
      value: 'status', label: '状態', type: 'select',
      options: VEHICLE_STATUSES.map((s) => ({ value: s, label: s })),
    },
    { value: 'purchase_price',       label: '仕入価格',     type: 'number' },
    { value: 'sale_price',           label: '希望売価',     type: 'number' },
    { value: 'sold_price',           label: '売却価格',     type: 'number' },
    { value: 'next_inspection_date', label: '次回車検期日', type: 'date' },
  ]

  const groupableFields = FIELDS.map((f) => ({ key: f.value, label: f.label }))

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2"><NavIcon icon="🚗" className="w-6 h-6" />車両</h1>
          <p className="text-sm text-zinc-500 mt-1">
            全 {totalCount} 件{hasFilter && <span className="ml-1 text-blue-600">（絞り込み中）</span>}
            {isGrouped && <span className="ml-1 text-violet-600">（グルーピング中）</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CsvToolbar
            exportUrl="/api/export/vehicles"
            importUrl="/api/import/vehicles"
            label="車両"
            csvFormat="ID,メーカー,車種,年式,走行距離(km),色,ナンバー,車台番号,状態,仕入日,仕入価格,仕入元,希望売価,売却日,売却価格,売却先,次回車検期日,備考"
            fieldOptions={{
              '状態': [...VEHICLE_STATUSES],
            }}
            showImport={edit}
          />
          {edit && (
            <Link
              href="/vehicles/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              ＋ 新規追加
            </Link>
          )}
        </div>
      </div>

      <SavedViewsPanel
        objectType="vehicles"
        basePath="/vehicles"
        currentFilterRaw={filterRaw}
        currentGroup={sp.group ?? ''}
        currentSort={sortRaw}
      />
      <ListViewToolbar
        fields={FIELDS}
        initialFilters={filterRaw}
        basePath="/vehicles"
        groupableFields={groupableFields}
        initialGroup={sp.group ?? ''}
      />

      {totalCount === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <div className="flex justify-center mb-4"><NavIcon icon="🚗" className="w-12 h-12 text-zinc-300" /></div>
          <p className="text-lg font-medium">
            {hasFilter ? '条件に一致する車両がありません' : '車両がまだ登録されていません'}
          </p>
          {hasFilter
            ? <Link href="/vehicles" className="text-sm text-blue-600 hover:underline mt-1 block">絞り込みをクリア</Link>
            : <p className="text-sm mt-1">「新規追加」ボタンから登録してください</p>
          }
        </div>
      ) : (
        <>
          {/* PC: 動的テーブル（グルーピング対応） */}
          <div className="hidden md:block">
            <TableErrorBoundary>
              <VehiclesTableView
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
                const v = rec as typeof raw[0]
                const days = daysUntilInspection(v.next_inspection_date)
                const expiringSoon = days != null && days <= 30 && days >= 0
                const expired = days != null && days < 0
                const sold = v.status === '販売済' || v.sold_price != null
                return (
                  <Link href={`/vehicles/${v.id}`} className="block bg-white rounded-lg border border-zinc-200 px-4 py-3 hover:border-zinc-300 active:bg-zinc-50">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-zinc-900 text-sm leading-snug">
                        {v.maker} {v.model}
                      </span>
                      <span className={`shrink-0 inline-block px-2 py-0.5 text-xs rounded ${vehicleStatusColor(v.status)}`}>
                        {v.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-zinc-500">
                      {v.year && <span>{v.year}年式</span>}
                      {v.mileage && <span>{Number(v.mileage).toLocaleString()} km</span>}
                      {v.license_plate && <span className="inline-flex items-center gap-1"><NavIcon icon="🚙" className="w-3 h-3 shrink-0" />{v.license_plate}</span>}
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-xs">
                      {v.next_inspection_date ? (
                        <span className={expired ? 'text-red-600 font-medium' : expiringSoon ? 'text-orange-600 font-medium' : 'text-zinc-500'}>
                          車検: {v.next_inspection_date}
                          {days != null && (
                            <span className="ml-1 text-zinc-400">
                              ({expired ? `${-days}日経過` : `あと${days}日`})
                            </span>
                          )}
                        </span>
                      ) : <span className="text-zinc-400">車検: —</span>}
                      {sold && v.sold_price ? (
                        <span className="font-semibold text-green-700">¥{Number(v.sold_price).toLocaleString()}</span>
                      ) : v.sale_price ? (
                        <span className="text-zinc-700">¥{Number(v.sale_price).toLocaleString()}</span>
                      ) : null}
                    </div>
                  </Link>
                )
              }}
            />
          </div>
        </>
      )}

      {!isGrouped && (
        <Pagination currentPage={page} totalPages={totalPages} basePath="/vehicles" filterParams={filterRaw} />
      )}
    </div>
  )
}
