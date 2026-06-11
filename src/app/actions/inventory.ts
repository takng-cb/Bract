'use server'

/**
 * inventory モジュール（Issue #48）の Server Actions。
 * products / warehouses / stock_movements の CRUD。
 * lot/serial は #71 へ先送り。
 */
import { db } from '@/lib/db'
import { trashRecord } from '@/lib/trash'
import { products, warehouses, stock_movements } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { MOVEMENT_TYPES, computeStockBalance } from '@/lib/inventory'
import { requirePermission } from '@/lib/permissions'

function s(formData: FormData, key: string): string | null {
  const v = formData.get(key)
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}
function num(formData: FormData, key: string): string | null {
  const v = formData.get(key)
  if (typeof v !== 'string' || v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? String(n) : null
}
function int(formData: FormData, key: string): number | null {
  const v = formData.get(key)
  if (typeof v !== 'string' || v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : null
}

// ── products ────────────────────────────────────────────
export async function createProduct(formData: FormData): Promise<string> {
  await requirePermission('products', 'create')
  const sku  = s(formData, 'sku')
  const name = s(formData, 'name')
  if (!sku)  throw new Error('SKU は必須です')
  if (!name) throw new Error('商品名は必須です')

  const [row] = await db.insert(products).values({
    sku,
    name,
    category:            s(formData, 'category'),
    unit:                s(formData, 'unit'),
    unit_price:          num(formData, 'unit_price'),
    cost_price:          num(formData, 'cost_price'),
    reorder_level:       int(formData, 'reorder_level') ?? 0,
    supplier_account_id: s(formData, 'supplier_account_id'),
    description:         s(formData, 'description'),
    owner_id:            s(formData, 'owner_id'),
  }).returning({ id: products.id })

  revalidatePath('/products')
  return row.id
}

export async function updateProduct(id: string, formData: FormData): Promise<void> {
  await requirePermission('products', 'update')
  const sku  = s(formData, 'sku')
  const name = s(formData, 'name')
  if (!sku)  throw new Error('SKU は必須です')
  if (!name) throw new Error('商品名は必須です')

  await db.update(products).set({
    sku,
    name,
    category:            s(formData, 'category'),
    unit:                s(formData, 'unit'),
    unit_price:          num(formData, 'unit_price'),
    cost_price:          num(formData, 'cost_price'),
    reorder_level:       int(formData, 'reorder_level') ?? 0,
    supplier_account_id: s(formData, 'supplier_account_id'),
    description:         s(formData, 'description'),
    owner_id:            s(formData, 'owner_id'),
    updated_at:          new Date(),
  }).where(eq(products.id, id))

  revalidatePath('/products')
  revalidatePath(`/products/${id}`)
  redirect(`/products/${id}`)
}

/**
 * インライン編集用・部分更新。送信されたフィールドだけ更新（formData.has 判定）。
 * SKU/商品名は必須のため空送信時は更新しない。
 */
export async function updateProductBasic(id: string, formData: FormData): Promise<void> {
  await requirePermission('products', 'update')
  const set: Record<string, unknown> = { updated_at: new Date() }
  if (formData.has('category'))            set.category = s(formData, 'category')
  if (formData.has('unit'))                set.unit = s(formData, 'unit')
  if (formData.has('unit_price'))          set.unit_price = num(formData, 'unit_price')
  if (formData.has('cost_price'))          set.cost_price = num(formData, 'cost_price')
  if (formData.has('reorder_level'))       set.reorder_level = int(formData, 'reorder_level') ?? 0
  if (formData.has('supplier_account_id')) set.supplier_account_id = s(formData, 'supplier_account_id')
  if (formData.has('owner_id'))            set.owner_id = s(formData, 'owner_id')
  if (formData.has('description'))         set.description = s(formData, 'description')
  if (formData.has('sku') && s(formData, 'sku'))   set.sku = s(formData, 'sku')
  if (formData.has('name') && s(formData, 'name')) set.name = s(formData, 'name')
  await db.update(products).set(set).where(eq(products.id, id))
  revalidatePath('/products')
  revalidatePath(`/products/${id}`)
  redirect(`/products/${id}`)
}

/**
 * インライン編集用・部分更新。送信されたフィールドだけ更新（formData.has 判定）。
 * 倉庫名(name)/コード(code) は必須のため空送信時は更新しない。
 */
export async function updateWarehouseBasic(id: string, formData: FormData): Promise<void> {
  await requirePermission('warehouses', 'update')
  const set: Record<string, unknown> = { updated_at: new Date() }
  if (formData.has('location')) set.location = s(formData, 'location')
  if (formData.has('note'))     set.note = s(formData, 'note')
  if (formData.has('code') && s(formData, 'code')) set.code = s(formData, 'code')
  if (formData.has('name') && s(formData, 'name')) set.name = s(formData, 'name')
  await db.update(warehouses).set(set).where(eq(warehouses.id, id))
  revalidatePath('/warehouses')
  revalidatePath(`/warehouses/${id}`)
  redirect(`/warehouses/${id}`)
}

export async function deleteProduct(id: string): Promise<void> {
  await requirePermission('products', 'delete')
  await trashRecord('products', id)  // 実削除の前にゴミ箱へ退避（REQ-0047）
  await db.delete(products).where(eq(products.id, id)) // cascade で stock_movements も削除
  revalidatePath('/products')
  redirect('/products')
}

// ── warehouses ──────────────────────────────────────────
export async function createWarehouse(formData: FormData): Promise<string> {
  await requirePermission('warehouses', 'create')
  const code = s(formData, 'code')
  const name = s(formData, 'name')
  if (!code) throw new Error('倉庫コードは必須です')
  if (!name) throw new Error('倉庫名は必須です')

  const [row] = await db.insert(warehouses).values({
    code,
    name,
    location: s(formData, 'location'),
    note:     s(formData, 'note'),
  }).returning({ id: warehouses.id })

  revalidatePath('/warehouses')
  return row.id
}

export async function updateWarehouse(id: string, formData: FormData): Promise<void> {
  await requirePermission('warehouses', 'update')
  const code = s(formData, 'code')
  const name = s(formData, 'name')
  if (!code) throw new Error('倉庫コードは必須です')
  if (!name) throw new Error('倉庫名は必須です')

  await db.update(warehouses).set({
    code,
    name,
    location:   s(formData, 'location'),
    note:       s(formData, 'note'),
    updated_at: new Date(),
  }).where(eq(warehouses.id, id))

  revalidatePath('/warehouses')
  revalidatePath(`/warehouses/${id}`)
  redirect(`/warehouses/${id}`)
}

export async function deleteWarehouse(id: string): Promise<void> {
  await requirePermission('warehouses', 'delete')
  await trashRecord('warehouses', id)  // 実削除の前にゴミ箱へ退避（REQ-0047）
  // 移動の warehouse_id は ON DELETE SET NULL（移動履歴自体は残る）
  await db.delete(warehouses).where(eq(warehouses.id, id))
  revalidatePath('/warehouses')
  redirect('/warehouses')
}

// ── stock_movements ─────────────────────────────────────
export async function createStockMovement(formData: FormData): Promise<void> {
  await requirePermission('stock_movements', 'create')
  const productId    = s(formData, 'product_id')
  const movementType = s(formData, 'movement_type')
  const quantity     = int(formData, 'quantity')
  if (!productId) throw new Error('商品は必須です')
  if (!movementType || !(MOVEMENT_TYPES as readonly string[]).includes(movementType)) {
    throw new Error('移動種別が不正です')
  }
  if (quantity == null) throw new Error('数量は必須です')

  await db.insert(stock_movements).values({
    product_id:    productId,
    warehouse_id:  s(formData, 'warehouse_id'),
    movement_type: movementType,
    quantity,
    unit_price:    num(formData, 'unit_price'),
    occurred_at:   s(formData, 'occurred_at') ?? new Date().toISOString().slice(0, 10),
    reference:     s(formData, 'reference'),
    note:          s(formData, 'note'),
    owner_id:      s(formData, 'owner_id'),
  })

  revalidatePath('/stock-movements')
  revalidatePath('/products')
  revalidatePath(`/products/${productId}`)
  redirect('/stock-movements')
}

/**
 * 棚卸調整 — 実在庫数 (actual_qty) に合わせて在庫を補正する。
 *
 * '調整' は movementDelta が符号そのままで加算する（abs しない）ため、
 * delta = actual - current を quantity に保存すれば
 *   新在庫 = current + (actual - current) = actual
 * となり、調整後の在庫合計が必ず実在庫数に一致する。
 * 倉庫を指定した場合はその倉庫別在庫、未指定（null）の場合は
 * warehouse_id が null の在庫を基準に補正する。
 * 差分が 0（実在庫 == 現在庫）の場合は何も記録しない。
 */
export async function applyStocktake(formData: FormData): Promise<void> {
  await requirePermission('stock_movements', 'create')
  const productId = s(formData, 'product_id')
  const warehouseId = s(formData, 'warehouse_id') // null 可（倉庫未指定）
  const actual = int(formData, 'actual_qty')
  if (!productId) throw new Error('商品は必須です')
  if (actual == null) throw new Error('実在庫数は必須です')

  // 対象商品 + 倉庫スコープの現在庫を算出
  const movements = await db.select({
    movement_type: stock_movements.movement_type,
    quantity:      stock_movements.quantity,
    warehouse_id:  stock_movements.warehouse_id,
  }).from(stock_movements).where(eq(stock_movements.product_id, productId))

  const { byWarehouse } = computeStockBalance(movements)
  const current = byWarehouse.get(warehouseId ?? '') ?? 0
  const delta = actual - current

  if (delta !== 0) {
    await db.insert(stock_movements).values({
      product_id:    productId,
      warehouse_id:  warehouseId,
      movement_type: '調整',
      quantity:      delta, // 符号付き（実在庫 - 現在庫）→ 補正後在庫 = 実在庫
      occurred_at:   new Date().toISOString().slice(0, 10),
      note:          '棚卸調整',
    })
  }

  revalidatePath('/stock-movements')
  revalidatePath('/products')
  revalidatePath(`/products/${productId}`)
  redirect(`/products/${productId}`)
}

export async function deleteStockMovement(id: string): Promise<void> {
  await requirePermission('stock_movements', 'delete')
  const [row] = await db.delete(stock_movements)
    .where(eq(stock_movements.id, id))
    .returning({ product_id: stock_movements.product_id })
  revalidatePath('/stock-movements')
  revalidatePath('/products')
  if (row?.product_id) revalidatePath(`/products/${row.product_id}`)
}
