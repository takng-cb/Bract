'use server'

import { db } from '@/lib/db'
import {
  maintenance_templates, maintenance_template_lines, maintenance_template_fees,
  maintenance_line_items, maintenance_fees,
} from '@/lib/schema'
import { eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/permissions'

function pick(formData: FormData, key: string): string | null {
  const v = (formData.get(key) as string) || ''
  return v.trim() === '' ? null : v.trim()
}

// ─── テンプレ本体の CRUD ───────────────────────────────────

export async function createTemplate(formData: FormData): Promise<string> {
  await requirePermission('maintenance_records', 'create')
  const name = pick(formData, 'name')
  if (!name) throw new Error('テンプレ名は必須です')

  const [row] = await db.insert(maintenance_templates).values({
    name,
    description: pick(formData, 'description'),
    category:    pick(formData, 'category'),
    is_active:   formData.get('is_active') !== 'false',
    sort_order:  Number(pick(formData, 'sort_order') ?? '0'),
  }).returning({ id: maintenance_templates.id })

  revalidatePath('/maintenance/templates')
  return row.id
}

export async function updateTemplate(id: string, formData: FormData) {
  await requirePermission('maintenance_records', 'update')
  const name = pick(formData, 'name')
  if (!name) throw new Error('テンプレ名は必須です')

  await db.update(maintenance_templates).set({
    name,
    description: pick(formData, 'description'),
    category:    pick(formData, 'category'),
    is_active:   formData.get('is_active') !== 'false',
    sort_order:  Number(pick(formData, 'sort_order') ?? '0'),
    updated_at:  new Date(),
  }).where(eq(maintenance_templates.id, id))

  revalidatePath('/maintenance/templates')
  revalidatePath(`/maintenance/templates/${id}`)
  redirect(`/maintenance/templates/${id}`)
}

export async function deleteTemplate(id: string) {
  await requirePermission('maintenance_records', 'delete')
  await db.delete(maintenance_templates).where(eq(maintenance_templates.id, id))
  revalidatePath('/maintenance/templates')
  redirect('/maintenance/templates')
}

// ─── テンプレ内の行アイテム ───────────────────────────────

async function nextLineSortOrder(templateId: string): Promise<number> {
  const rows = await db.select({ max: sql<number>`COALESCE(MAX(${maintenance_template_lines.sort_order}), -1)` })
    .from(maintenance_template_lines)
    .where(eq(maintenance_template_lines.template_id, templateId))
  return Number(rows[0]?.max ?? -1) + 1
}

export async function createTemplateLine(templateId: string, formData: FormData) {
  await requirePermission('maintenance_records', 'create')
  const item_name = pick(formData, 'item_name')
  if (!item_name) throw new Error('項目名は必須です')

  const sort_order = await nextLineSortOrder(templateId)

  await db.insert(maintenance_template_lines).values({
    template_id:      templateId,
    sort_order,
    work_category:    pick(formData, 'work_category'),
    item_name,
    hours:            pick(formData, 'hours'),
    labor_amount:     pick(formData, 'labor_amount'),
    parts_qty:        pick(formData, 'parts_qty'),
    parts_unit:       pick(formData, 'parts_unit'),
    parts_unit_price: pick(formData, 'parts_unit_price'),
    cost_unit_price:  pick(formData, 'cost_unit_price'),
    note:             pick(formData, 'note'),
  })

  revalidatePath(`/maintenance/templates/${templateId}`)
}

export async function updateTemplateLine(templateId: string, lineId: string, formData: FormData) {
  await requirePermission('maintenance_records', 'update')
  const item_name = pick(formData, 'item_name')
  if (!item_name) throw new Error('項目名は必須です')

  await db.update(maintenance_template_lines).set({
    work_category:    pick(formData, 'work_category'),
    item_name,
    hours:            pick(formData, 'hours'),
    labor_amount:     pick(formData, 'labor_amount'),
    parts_qty:        pick(formData, 'parts_qty'),
    parts_unit:       pick(formData, 'parts_unit'),
    parts_unit_price: pick(formData, 'parts_unit_price'),
    cost_unit_price:  pick(formData, 'cost_unit_price'),
    note:             pick(formData, 'note'),
  }).where(eq(maintenance_template_lines.id, lineId))

  revalidatePath(`/maintenance/templates/${templateId}`)
}

export async function deleteTemplateLine(templateId: string, lineId: string) {
  await requirePermission('maintenance_records', 'delete')
  await db.delete(maintenance_template_lines).where(eq(maintenance_template_lines.id, lineId))
  revalidatePath(`/maintenance/templates/${templateId}`)
}

// ─── テンプレ内の諸費用 ───────────────────────────────────

async function nextFeeSortOrder(templateId: string): Promise<number> {
  const rows = await db.select({ max: sql<number>`COALESCE(MAX(${maintenance_template_fees.sort_order}), -1)` })
    .from(maintenance_template_fees)
    .where(eq(maintenance_template_fees.template_id, templateId))
  return Number(rows[0]?.max ?? -1) + 1
}

export async function createTemplateFee(templateId: string, formData: FormData) {
  await requirePermission('maintenance_records', 'create')
  const item_name = pick(formData, 'item_name')
  if (!item_name) throw new Error('項目名は必須です')
  const category = pick(formData, 'category')
  if (category !== '課税' && category !== '非課税') throw new Error('区分は課税/非課税のいずれかです')

  const sort_order = await nextFeeSortOrder(templateId)

  await db.insert(maintenance_template_fees).values({
    template_id:  templateId,
    sort_order,
    category,
    item_name,
    amount:       pick(formData, 'amount'),
    cost_amount:  pick(formData, 'cost_amount'),
  })

  revalidatePath(`/maintenance/templates/${templateId}`)
}

export async function deleteTemplateFee(templateId: string, feeId: string) {
  await requirePermission('maintenance_records', 'delete')
  await db.delete(maintenance_template_fees).where(eq(maintenance_template_fees.id, feeId))
  revalidatePath(`/maintenance/templates/${templateId}`)
}

// ─── テンプレ適用：1 クリックで maintenance に投入 ──────────

export async function applyTemplateToMaintenance(templateId: string, maintenanceId: string): Promise<{ lines: number; fees: number }> {
  await requirePermission('maintenance_records', 'create')

  // テンプレ内容を読む
  const [tLines, tFees] = await Promise.all([
    db.select().from(maintenance_template_lines)
      .where(eq(maintenance_template_lines.template_id, templateId)),
    db.select().from(maintenance_template_fees)
      .where(eq(maintenance_template_fees.template_id, templateId)),
  ])

  // 既存 maintenance の最大 sort_order を取得（追記方式）
  const [lineMaxRow, feeMaxRow] = await Promise.all([
    db.select({ max: sql<number>`COALESCE(MAX(${maintenance_line_items.sort_order}), -1)` })
      .from(maintenance_line_items)
      .where(eq(maintenance_line_items.maintenance_id, maintenanceId)),
    db.select({ max: sql<number>`COALESCE(MAX(${maintenance_fees.sort_order}), -1)` })
      .from(maintenance_fees)
      .where(eq(maintenance_fees.maintenance_id, maintenanceId)),
  ])
  const lineStart = Number(lineMaxRow[0]?.max ?? -1) + 1
  const feeStart  = Number(feeMaxRow[0]?.max ?? -1) + 1

  // 並列 INSERT
  for (let i = 0; i < tLines.length; i++) {
    const l = tLines[i]
    await db.insert(maintenance_line_items).values({
      maintenance_id:   maintenanceId,
      sort_order:       lineStart + i,
      work_category:    l.work_category,
      item_name:        l.item_name,
      hours:            l.hours,
      labor_amount:     l.labor_amount,
      parts_qty:        l.parts_qty,
      parts_unit:       l.parts_unit,
      parts_unit_price: l.parts_unit_price,
      cost_unit_price:  l.cost_unit_price,
      note:             l.note,
      work_status:      '未完了',
    })
  }

  for (let i = 0; i < tFees.length; i++) {
    const f = tFees[i]
    await db.insert(maintenance_fees).values({
      maintenance_id: maintenanceId,
      sort_order:     feeStart + i,
      category:       f.category,
      item_name:      f.item_name,
      amount:         f.amount,
      cost_amount:    f.cost_amount,
    })
  }

  revalidatePath(`/maintenance/${maintenanceId}`)
  return { lines: tLines.length, fees: tFees.length }
}

// ─── 既存 maintenance からテンプレに保存 ───────────────────

export async function saveMaintenanceAsTemplate(maintenanceId: string, name: string, category: string | null): Promise<string> {
  await requirePermission('maintenance_records', 'update')
  if (!name.trim()) throw new Error('テンプレ名は必須です')

  // 元の整備の行・諸費用を取得
  const [lines, fees] = await Promise.all([
    db.select().from(maintenance_line_items)
      .where(eq(maintenance_line_items.maintenance_id, maintenanceId)),
    db.select().from(maintenance_fees)
      .where(eq(maintenance_fees.maintenance_id, maintenanceId)),
  ])

  const [tpl] = await db.insert(maintenance_templates).values({
    name:       name.trim(),
    category:   category?.trim() || null,
    is_active:  true,
    sort_order: 0,
  }).returning({ id: maintenance_templates.id })

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    await db.insert(maintenance_template_lines).values({
      template_id:      tpl.id,
      sort_order:       i,
      work_category:    l.work_category,
      item_name:        l.item_name ?? '無題',
      hours:            l.hours,
      labor_amount:     l.labor_amount,
      parts_qty:        l.parts_qty,
      parts_unit:       l.parts_unit,
      parts_unit_price: l.parts_unit_price,
      cost_unit_price:  l.cost_unit_price,
      note:             l.note,
    })
  }

  for (let i = 0; i < fees.length; i++) {
    const f = fees[i]
    await db.insert(maintenance_template_fees).values({
      template_id:  tpl.id,
      sort_order:   i,
      category:     f.category,
      item_name:    f.item_name,
      amount:       f.amount,
      cost_amount:  f.cost_amount,
    })
  }

  revalidatePath('/maintenance/templates')
  return tpl.id
}
