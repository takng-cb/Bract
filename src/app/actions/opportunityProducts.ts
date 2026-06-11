'use server'

/**
 * 商談の商品明細（opportunity_products）の Server Actions。#5
 * 紐付け先は polymorphic（product_object_api + product_record_id）。
 */
import { db } from '@/lib/db'
import { opportunity_products } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { requireEditor } from '@/lib/auth'

function numOrNull(v: FormDataEntryValue | null): string | null {
  const s = (v ?? '').toString().trim()
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? String(n) : null
}

/** 商品明細を追加。target は "<object_api>:<record_id>" 形式（フリー入力なら空） */
export async function addOpportunityProduct(opportunityId: string, formData: FormData) {
  await requireEditor()
  const target = (formData.get('target') ?? '').toString().trim()
  let objectApi = 'product'
  let recordId: string | null = null
  if (target) {
    const idx = target.indexOf(':')
    if (idx > 0) {
      objectApi = target.slice(0, idx)
      recordId = target.slice(idx + 1) || null
    }
  }
  const name = (formData.get('name') ?? '').toString().trim()
  if (!name) throw new Error('商品名は必須です')

  await db.insert(opportunity_products).values({
    opportunity_id:     opportunityId,
    product_object_api: objectApi,
    product_record_id:  recordId,
    name,
    quantity:           numOrNull(formData.get('quantity')) ?? '1',
    unit_price:         numOrNull(formData.get('unit_price')),
    note:               (formData.get('note') ?? '').toString().trim() || null,
  })
  revalidatePath(`/opportunities/${opportunityId}`)
}

/** 商品明細を更新（数量・単価・メモ） */
export async function updateOpportunityProduct(id: string, opportunityId: string, formData: FormData) {
  await requireEditor()
  await db.update(opportunity_products).set({
    quantity:   numOrNull(formData.get('quantity')) ?? '1',
    unit_price: numOrNull(formData.get('unit_price')),
    note:       (formData.get('note') ?? '').toString().trim() || null,
    updated_at: new Date(),
  }).where(eq(opportunity_products.id, id))
  revalidatePath(`/opportunities/${opportunityId}`)
}

/** 商品明細を削除 */
export async function deleteOpportunityProduct(id: string, opportunityId: string) {
  await requireEditor()
  await db.delete(opportunity_products).where(eq(opportunity_products.id, id))
  revalidatePath(`/opportunities/${opportunityId}`)
}
