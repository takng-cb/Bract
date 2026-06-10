/**
 * /warehouses/[id] — 倉庫 詳細（新2カラムレイアウト / #design）
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Warehouse, Package, Boxes } from 'lucide-react'
import { isModuleEnabled } from '@/lib/modules/registry'
import { db } from '@/lib/db'
import { warehouses, stock_movements, products } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import RecordHeader from '@/components/RecordHeader'
import AuthGuard from '@/components/AuthGuard'
import DeleteButton from '@/components/DeleteButton'
import RecordId from '@/components/RecordId'
import { computeStockBalance } from '@/lib/inventory'
import { deleteWarehouse, updateWarehouseBasic } from '@/app/actions/inventory'
import { canEdit } from '@/lib/auth'
import EditableInfoCard from '@/components/detail/EditableInfoCard'
import InlineEditButton from '@/components/detail/InlineEditButton'
import { RecordColumns, KpiBand, Badge, RecordTable, RecordTableEmpty, type KpiItem } from '@/components/record/RecordUI'
import RecordTabPanel from '@/components/record/RecordTabPanel'

export const dynamic = 'force-dynamic'

export default async function WarehouseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await isModuleEnabled('inventory'))) notFound()

  const [w, rows] = await Promise.all([
    db.select().from(warehouses).where(eq(warehouses.id, id)).then((r) => r[0] ?? null),
    db.select({ product_id: stock_movements.product_id, product_name: products.name, product_sku: products.sku, movement_type: stock_movements.movement_type, quantity: stock_movements.quantity })
      .from(stock_movements).leftJoin(products, eq(stock_movements.product_id, products.id)).where(eq(stock_movements.warehouse_id, id)).orderBy(asc(products.sku)),
  ])
  if (!w) notFound()
  const editFlag = await canEdit()

  async function saveWarehouseInline(formData: FormData) { 'use server'; await updateWarehouseBasic(id, formData) }
  async function handleDelete() { 'use server'; await deleteWarehouse(id) }

  const byProduct = new Map<string, { name: string; sku: string; movements: { movement_type: string; quantity: number | null }[] }>()
  for (const r of rows) {
    const entry = byProduct.get(r.product_id) ?? { name: r.product_name ?? '（不明）', sku: r.product_sku ?? '', movements: [] }
    entry.movements.push({ movement_type: r.movement_type, quantity: r.quantity })
    byProduct.set(r.product_id, entry)
  }
  const stockList = [...byProduct.entries()].map(([pid, e]) => ({ pid, name: e.name, sku: e.sku, qty: computeStockBalance(e.movements).total })).filter((e) => e.qty !== 0)
  const totalQty = stockList.reduce((s, e) => s + e.qty, 0)

  const kpis: KpiItem[] = [
    { icon: <Package />, label: '在庫品目', value: <>{stockList.length}<small> 品目</small></>, sub: 'この倉庫' },
    { icon: <Boxes />, label: '総在庫数', value: totalQty.toLocaleString(), sub: '合計数量' },
  ]

  const stockTab = stockList.length === 0 ? <RecordTableEmpty>在庫がありません</RecordTableEmpty> : (
    <RecordTable columns={[{ label: 'SKU' }, { label: '商品名' }, { label: '在庫', num: true }]}>
      {stockList.map((s) => (
        <tr key={s.pid} className="hover:bg-zinc-50">
          <td className="px-4 py-2.5 border-b border-zinc-100 font-mono text-xs text-zinc-500">{s.sku}</td>
          <td className="px-4 py-2.5 border-b border-zinc-100 font-semibold text-zinc-900"><Link href={`/products/${s.pid}`} className="hover:text-brand-700">{s.name}</Link></td>
          <td className="px-4 py-2.5 border-b border-zinc-100 text-right tabular-nums font-semibold text-zinc-700">{s.qty}</td>
        </tr>
      ))}
    </RecordTable>
  )

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <RecordHeader
        crumbs={[{ label: '倉庫', href: '/warehouses' }, { label: w.name }]}
        title={w.name}
        avatar={<Warehouse className="w-6 h-6" strokeWidth={2.25} />}
        badges={<Badge tone="neutral">{w.code}</Badge>}
        meta={[...(w.location ? [{ label: '所在地', value: w.location }] : [])]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2">
              <InlineEditButton event="bract:edit-warehouse" />
              <DeleteButton action={handleDelete} confirmMessage="この倉庫を削除しますか？在庫移動の倉庫参照は空になります（履歴は残ります）。" />
            </div>
          </AuthGuard>
        }
      />

      <KpiBand items={kpis} />

      <RecordColumns
        left={
          <EditableInfoCard
            title="倉庫情報"
            dense
            canEdit={editFlag}

            editEvent="bract:edit-warehouse"
            action={saveWarehouseInline}
            fields={[
              { label: '倉庫名', name: 'name', kind: 'text', value: w.name, view: w.name ?? '—' },
              { label: 'コード', name: 'code', kind: 'text', value: w.code, view: w.code ? <span className="font-mono">{w.code}</span> : '—' },
              { label: '所在地', name: 'location', kind: 'text', value: w.location, view: w.location ?? '—' },
              { label: '備考', name: 'note', kind: 'textarea', value: w.note, fullWidth: true, view: w.note ? w.note : <span className="text-zinc-300">—</span> },
            ]}
          />
        }
      >
        <RecordTabPanel tabs={[{ id: 'stock', label: 'この倉庫の在庫', icon: <Boxes />, count: stockList.length, content: stockTab }]} />
        <div className="mt-4 text-right"><RecordId id={id} /></div>
      </RecordColumns>
    </div>
  )
}
