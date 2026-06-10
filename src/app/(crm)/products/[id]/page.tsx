/**
 * /products/[id] — 商品 詳細（新2カラムレイアウト / #design）
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Package, Boxes, Wallet, Warehouse, TriangleAlert } from 'lucide-react'
import { isModuleEnabled } from '@/lib/modules/registry'
import { db } from '@/lib/db'
import { products, warehouses, stock_movements, accounts } from '@/lib/schema'
import { eq, desc, asc } from 'drizzle-orm'
import RecordHeader from '@/components/RecordHeader'
import AuthGuard from '@/components/AuthGuard'
import DeleteButton from '@/components/DeleteButton'
import RecordId from '@/components/RecordId'
import { computeStockBalance, isBelowReorder } from '@/lib/inventory'
import { deleteProduct, updateProductBasic } from '@/app/actions/inventory'
import { canEdit } from '@/lib/auth'
import { getAllUsers } from '@/lib/userUtils'
import EditableInfoCard from '@/components/detail/EditableInfoCard'
import InlineEditButton from '@/components/detail/InlineEditButton'
import { RecordColumns, KpiBand, RefCard, Badge, RecordTable, RecordTableEmpty, type KpiItem, type BadgeTone } from '@/components/record/RecordUI'
import RecordTabPanel from '@/components/record/RecordTabPanel'

export const dynamic = 'force-dynamic'

const MOVE_TONE: Record<string, BadgeTone> = { 入庫: 'info', 出庫: 'warn', 調整: 'ai' }

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await isModuleEnabled('inventory'))) notFound()

  const [productRow, movementRows, warehouseRows] = await Promise.all([
    db.select({
      id: products.id, sku: products.sku, name: products.name,
      category: products.category, unit: products.unit,
      unit_price: products.unit_price, cost_price: products.cost_price,
      reorder_level: products.reorder_level, description: products.description,
      created_at: products.created_at, owner_id: products.owner_id,
      supplier: { id: accounts.id, name: accounts.name },
    })
      .from(products).leftJoin(accounts, eq(products.supplier_account_id, accounts.id)).where(eq(products.id, id)).then((r) => r[0] ?? null),
    db.select({ id: stock_movements.id, warehouse_id: stock_movements.warehouse_id, movement_type: stock_movements.movement_type, quantity: stock_movements.quantity, unit_price: stock_movements.unit_price, occurred_at: stock_movements.occurred_at, reference: stock_movements.reference, note: stock_movements.note })
      .from(stock_movements).where(eq(stock_movements.product_id, id)).orderBy(desc(stock_movements.occurred_at), desc(stock_movements.created_at)),
    db.select({ id: warehouses.id, code: warehouses.code, name: warehouses.name }).from(warehouses).orderBy(asc(warehouses.code)),
  ])

  if (!productRow) notFound()

  const [editFlag, supplierAccounts, usersList] = await Promise.all([
    canEdit(),
    db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
    getAllUsers(),
  ])
  const ownerName = productRow.owner_id ? (usersList.find((u) => u.id === productRow.owner_id)?.name ?? null) : null

  async function saveProductInline(formData: FormData) { 'use server'; await updateProductBasic(id, formData) }
  async function handleDelete() { 'use server'; await deleteProduct(id) }

  const { total, byWarehouse } = computeStockBalance(movementRows)
  const warehouseName = new Map(warehouseRows.map((w) => [w.id, `${w.name}（${w.code}）`]))
  const unit = productRow.unit ? ` ${productRow.unit}` : ''
  const below = isBelowReorder(total, productRow.reorder_level ?? 0)
  const margin = productRow.unit_price != null && productRow.cost_price != null ? Number(productRow.unit_price) - Number(productRow.cost_price) : null

  const perWarehouse = [...byWarehouse.entries()]
    .map(([wid, qty]) => ({ wid, label: wid ? (warehouseName.get(wid) ?? '（不明な倉庫）') : '（倉庫未指定）', qty }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ja'))

  const kpis: KpiItem[] = [
    { icon: <Boxes />, label: '在庫', value: <>{total}<small>{unit}</small></>, sub: `発注点 ${productRow.reorder_level ?? 0}`, subTone: below ? 'down' : 'mut' },
    { icon: <Wallet />, label: '売価', value: productRow.unit_price ? `¥${Number(productRow.unit_price).toLocaleString()}` : '—', sub: productRow.cost_price ? `原価 ¥${Number(productRow.cost_price).toLocaleString()}` : '—' },
    { icon: <Wallet />, label: '粗利', value: margin != null ? `¥${margin.toLocaleString()}` : '—', sub: margin != null && productRow.unit_price ? `率 ${Math.round((margin / Number(productRow.unit_price)) * 100)}%` : '—', subTone: 'up' },
    { icon: <Warehouse />, label: '拠点', value: <>{perWarehouse.length}<small> 箇所</small></>, sub: `移動 ${movementRows.length} 件` },
  ]

  const movementTab = movementRows.length === 0 ? <RecordTableEmpty>在庫移動履歴がありません</RecordTableEmpty> : (
    <RecordTable columns={[{ label: '日付' }, { label: '倉庫' }, { label: '種別' }, { label: '数量', num: true }, { label: '伝票/メモ' }]}>
      {movementRows.map((m) => (
        <tr key={m.id} className="hover:bg-zinc-50">
          <td className="px-4 py-2.5 border-b border-zinc-100 text-zinc-700 whitespace-nowrap">{m.occurred_at}</td>
          <td className="px-4 py-2.5 border-b border-zinc-100 text-zinc-600">{m.warehouse_id ? (warehouseName.get(m.warehouse_id) ?? '—') : '—'}</td>
          <td className="px-4 py-2.5 border-b border-zinc-100"><Badge tone={MOVE_TONE[m.movement_type] ?? 'neutral'}>{m.movement_type}</Badge></td>
          <td className={`px-4 py-2.5 border-b border-zinc-100 text-right tabular-nums font-semibold ${m.movement_type === '出庫' ? 'text-orange-600' : 'text-zinc-700'}`}>{m.movement_type === '出庫' ? '−' : '＋'} {m.quantity}</td>
          <td className="px-4 py-2.5 border-b border-zinc-100 text-zinc-500 truncate max-w-xs">{[m.reference, m.note].filter(Boolean).join(' / ') || '—'}</td>
        </tr>
      ))}
    </RecordTable>
  )

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <RecordHeader
        crumbs={[{ label: '商品', href: '/products' }, { label: productRow.name }]}
        title={productRow.name}
        avatar={<Package className="w-6 h-6" strokeWidth={2.25} />}
        badges={<Badge tone={below ? 'danger' : 'pos'} dot>在庫 {total}{unit}</Badge>}
        meta={[
          { label: 'SKU', value: productRow.sku, mono: true },
          ...(productRow.category ? [{ label: 'カテゴリ', value: productRow.category }] : []),
        ]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2">
              <InlineEditButton event="bract:edit-product" />
              <DeleteButton action={handleDelete} confirmMessage="この商品を削除しますか？関連する在庫移動もすべて削除されます。" />
            </div>
          </AuthGuard>
        }
      />

      {below && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-4 py-3 mb-5 text-sm font-medium flex items-center gap-2">
          <TriangleAlert className="w-4 h-4 shrink-0" />発注点を下回っています（在庫 {total}{unit} / 発注点 {productRow.reorder_level}{unit}）
        </div>
      )}

      <KpiBand items={kpis} />

      <RecordColumns
        left={
          <>
            <EditableInfoCard
              title="商品情報"
              dense
              canEdit={editFlag}

              editEvent="bract:edit-product"
              action={saveProductInline}
              fields={[
                { label: '商品名', name: 'name', kind: 'text', value: productRow.name, view: productRow.name ?? '—' },
                { label: 'SKU', name: 'sku', kind: 'text', value: productRow.sku, view: productRow.sku ? <span className="font-mono">{productRow.sku}</span> : '—' },
                { label: 'カテゴリ', name: 'category', kind: 'text', value: productRow.category, view: productRow.category ?? '—' },
                { label: '売価', name: 'unit_price', kind: 'number', value: productRow.unit_price != null ? String(productRow.unit_price) : '', view: productRow.unit_price ? `¥${Number(productRow.unit_price).toLocaleString()}` : '—' },
                { label: '原価', name: 'cost_price', kind: 'number', value: productRow.cost_price != null ? String(productRow.cost_price) : '', view: productRow.cost_price ? `¥${Number(productRow.cost_price).toLocaleString()}` : '—' },
                { label: '単位', name: 'unit', kind: 'text', value: productRow.unit, view: productRow.unit ?? '—' },
                { label: '発注点', name: 'reorder_level', kind: 'number', value: productRow.reorder_level != null ? String(productRow.reorder_level) : '', view: `${productRow.reorder_level}${unit}` },
                { label: '主仕入元', name: 'supplier_account_id', kind: 'select', value: productRow.supplier?.id ?? '', options: supplierAccounts.map((a) => ({ value: a.id, label: a.name })), view: productRow.supplier?.id ? <Link href={`/accounts/${productRow.supplier.id}`} className="text-brand-700 hover:underline">{productRow.supplier.name}</Link> : '—' },
                { label: '担当', name: 'owner_id', kind: 'select', value: productRow.owner_id ?? '', options: usersList.map((u) => ({ value: u.id, label: u.name })), view: ownerName ?? '—' },
                { label: '備考', name: 'description', kind: 'textarea', value: productRow.description, fullWidth: true, view: productRow.description ? productRow.description : <span className="text-zinc-300">—</span> },
              ]}
            />

            <RefCard title="倉庫別在庫" icon={<Warehouse />} action={<AuthGuard minRole="editor"><Link href="/stock-movements/new" className="text-xs text-brand-700 font-semibold hover:text-brand-800">＋ 入出庫</Link></AuthGuard>}>
              {perWarehouse.length === 0 ? <p className="text-sm text-zinc-400">在庫移動がまだありません</p> : (
                <dl className="space-y-1.5">
                  {perWarehouse.map((w) => (
                    <div key={w.wid || '__none__'} className="flex items-baseline justify-between gap-2 text-[13px]">
                      <dt className="text-zinc-600 truncate">{w.label}</dt>
                      <dd className="font-semibold text-zinc-900 shrink-0">{w.qty}{unit}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </RefCard>
          </>
        }
      >
        <RecordTabPanel
          tabs={[{ id: 'moves', label: '在庫移動履歴', icon: <Boxes />, count: movementRows.length, content: movementTab }]}
        />
        <div className="mt-4 text-right"><RecordId id={id} /></div>
      </RecordColumns>
    </div>
  )
}
