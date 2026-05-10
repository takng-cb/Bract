import { db } from '@/lib/db'
import { parts, part_movements } from '@/industries/auto-body/schema'
import { accounts } from '@/lib/schema'
import { asc, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ListViewToolbar from '@/components/ListViewToolbar'
import { type FieldDef } from '@/components/FilterBuilder'
import { parseFilterParams, applyFilters } from '@/lib/filterUtils'
import { parseSortParams, applySort } from '@/lib/sortUtils'
import Pagination from '@/components/Pagination'
import { canEdit, getCurrentUserId } from '@/lib/auth'
import { getListViewColumns } from '@/lib/listViewSettings'
import { getDefaultView } from '@/lib/savedViews'
import PartsTableView from '@/industries/auto-body/components/tableviews/PartsTableView'
import SavedViewsPanel from '@/components/SavedViewsPanel'
import TableErrorBoundary from '@/components/TableErrorBoundary'
import MobileGroupedCards from '@/components/MobileGroupedCards'
import { calcStock, stockBadgeColor } from '@/industries/auto-body/lib/partsHelpers'

const PAGE_SIZE = 20

export default async function PartsListPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[]; page?: string; group?: string; sort?: string }>
}) {
  const [sp, edit, colConfig, userId] = await Promise.all([
    searchParams,
    canEdit(),
    getListViewColumns('parts'),
    getCurrentUserId(),
  ])

  const filterRaw = [sp.f].flat().filter(Boolean) as string[]
  const page      = Math.max(1, parseInt(sp.page ?? '1', 10))
  const groupBy   = (sp.group ?? '').split(',').filter(Boolean)
  const isGrouped = groupBy.length > 0

  // デフォルトビュー適用
  if (filterRaw.length === 0 && groupBy.length === 0) {
    const dv = await getDefaultView('parts', userId)
    if (dv && (dv.filter_params.length > 0 || dv.group_params)) {
      const p = new URLSearchParams()
      dv.filter_params.forEach((f) => p.append('f', f))
      if (dv.group_params) p.set('group', dv.group_params)
      if (dv.sort_params) p.set('sort', dv.sort_params)
      redirect(`/parts?${p.toString()}`)
    }
  }

  const conditions = parseFilterParams(filterRaw)
  const sortRaw    = sp.sort ?? ''
  const sortDefs   = parseSortParams(sortRaw)

  const [partRows, allMovements] = await Promise.all([
    db.select({
      id:                  parts.id,
      part_number:         parts.part_number,
      name:                parts.name,
      category:            parts.category,
      unit_price:          parts.unit_price,
      reorder_level:       parts.reorder_level,
      supplier:            { id: accounts.id, name: accounts.name },
    })
      .from(parts)
      .leftJoin(accounts, eq(parts.supplier_account_id, accounts.id))
      .orderBy(asc(parts.part_number)),
    db.select({
      part_id: part_movements.part_id,
      movement_type: part_movements.movement_type,
      quantity: part_movements.quantity,
    }).from(part_movements),
  ])

  // part_id ごとに movements を集約 → 在庫数
  const movementsByPart = new Map<string, { movement_type: string; quantity: number | null }[]>()
  for (const m of allMovements) {
    const arr = movementsByPart.get(m.part_id) ?? []
    arr.push({ movement_type: m.movement_type, quantity: m.quantity })
    movementsByPart.set(m.part_id, arr)
  }

  // 各部品に在庫を埋め込み（フィルタ・ソート・グループ化が在庫を扱えるように）
  const enriched = partRows.map((p) => ({
    ...p,
    stock: calcStock(movementsByPart.get(p.id) ?? []),
  }))

  const list        = applyFilters(enriched as Record<string, unknown>[], conditions)
  const sorted      = applySort(list as Record<string, unknown>[], sortDefs)
  const hasFilter   = conditions.length > 0
  const totalCount  = sorted.length
  const totalPages  = isGrouped ? 1 : Math.ceil(totalCount / PAGE_SIZE)
  const displayList = isGrouped
    ? sorted
    : sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const lowStockCount = enriched.filter((p) => p.stock <= (p.reorder_level ?? 0)).length

  const FIELDS: FieldDef[] = [
    { value: 'part_number',   label: '品番',         type: 'text' },
    { value: 'name',          label: '部品名',       type: 'text' },
    { value: 'category',      label: 'カテゴリ',     type: 'text' },
    { value: 'unit_price',    label: '単価',         type: 'number' },
    { value: 'stock',         label: '在庫',         type: 'number' },
    { value: 'reorder_level', label: '発注しきい値', type: 'number' },
  ]

  const groupableFields = FIELDS.map((f) => ({ key: f.value, label: f.label }))

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">🔧 部品マスタ</h1>
          <p className="text-sm text-zinc-500 mt-1">
            全 {totalCount} 件{hasFilter && <span className="ml-1 text-blue-600">（絞り込み中）</span>}
            {isGrouped && <span className="ml-1 text-violet-600">（グルーピング中）</span>}
            {lowStockCount > 0 && (
              <span className="ml-2 text-orange-600">・要発注 {lowStockCount} 件</span>
            )}
          </p>
        </div>
        {edit && (
          <Link
            href="/parts/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            ＋ 新規追加
          </Link>
        )}
      </div>

      <SavedViewsPanel
        objectType="parts"
        basePath="/parts"
        currentFilterRaw={filterRaw}
        currentGroup={sp.group ?? ''}
        currentSort={sortRaw}
      />
      <ListViewToolbar
        fields={FIELDS}
        initialFilters={filterRaw}
        basePath="/parts"
        groupableFields={groupableFields}
        initialGroup={sp.group ?? ''}
      />

      {totalCount === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <p className="text-4xl mb-4">🔧</p>
          <p className="text-lg font-medium">
            {hasFilter ? '条件に一致する部品がありません' : '部品がまだ登録されていません'}
          </p>
          {hasFilter
            ? <Link href="/parts" className="text-sm text-blue-600 hover:underline mt-1 block">絞り込みをクリア</Link>
            : <p className="text-sm mt-1">「新規追加」ボタンから登録してください</p>
          }
        </div>
      ) : (
        <>
          {/* PC: 動的テーブル（グルーピング対応） */}
          <div className="hidden md:block">
            <TableErrorBoundary>
              <PartsTableView
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
                const p = rec as typeof enriched[0]
                return (
                  <Link href={`/parts/${p.id}`} className="block bg-white rounded-lg border border-zinc-200 px-4 py-3 hover:border-zinc-300 active:bg-zinc-50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="font-mono text-xs text-zinc-500">{p.part_number}</span>
                        <p className="font-semibold text-zinc-900 text-sm leading-snug">{p.name}</p>
                      </div>
                      <span className={`shrink-0 inline-block px-2 py-0.5 text-xs rounded font-semibold ${stockBadgeColor(p.stock, p.reorder_level ?? 0)}`}>
                        {p.stock} 個
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-zinc-500">
                      {p.category && <span>{p.category}</span>}
                      {p.unit_price && <span>¥{Number(p.unit_price).toLocaleString()}</span>}
                      {p.supplier?.id && <span>🏢 {p.supplier.name}</span>}
                    </div>
                  </Link>
                )
              }}
            />
          </div>
        </>
      )}

      {!isGrouped && (
        <Pagination currentPage={page} totalPages={totalPages} basePath="/parts" filterParams={filterRaw} />
      )}
    </div>
  )
}
