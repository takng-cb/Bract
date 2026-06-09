'use server'

/**
 * inventory モジュール（Issue #48）の Server Actions。
 * products / warehouses / stock_movements の CRUD。
 * lot/serial は #71 へ先送り。
 */
import { requireEditor } from '@/lib/auth'
import { db } from '@/lib/db'
import { products, warehouses, stock_movements } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { MOVEMENT_TYPES } from '@/lib/inventory'

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
  await requireEditor()
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
  await requireEditor()
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

export async function deleteProduct(id: string): Promise<void> {
  await requireEditor()
  await db.delete(products).where(eq(products.id, id)) // cascade で stock_movements も削除
  revalidatePath('/products')
  redirect('/products')
}

// ── warehouses ──────────────────────────────────────────
export async function createWarehouse(formData: FormData): Promise<string> {
  await requireEditor()
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
  await requireEditor()
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
  await requireEditor()
  // 移動の warehouse_id は ON DELETE SET NULL（移動履歴自体は残る）
  await db.delete(warehouses).where(eq(warehouses.id, id))
  revalidatePath('/warehouses')
  redirect('/warehouses')
}

// ── stock_movements ─────────────────────────────────────
export async function createStockMovement(formData: FormData): Promise<void> {
  await requireEditor()
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

export async function deleteStockMovement(id: string): Promise<void> {
  await requireEditor()
  const [row] = await db.delete(stock_movements)
    .where(eq(stock_movements.id, id))
    .returning({ product_id: stock_movements.product_id })
  revalidatePath('/stock-movements')
  revalidatePath('/products')
  if (row?.product_id) revalidatePath(`/products/${row.product_id}`)
}
