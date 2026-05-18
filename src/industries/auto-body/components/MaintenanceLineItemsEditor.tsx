/**
 * 作業項目編集 UI のサーバラッパ。
 * 初期データ + サーバアクションを StagedLineItemsTable に渡す。
 *
 * 編集は **ステージング型**：セル直接編集 → 「保存」で一括コミット。
 * 「キャンセル」で破棄してモーダルを閉じる。
 */
import { db } from '@/lib/db'
import { maintenance_line_items, maintenance_templates, maintenance_template_lines, maintenance_template_fees } from '@/lib/schema'
import { eq, asc, sql } from 'drizzle-orm'
import { createLineItem, updateLineItem, deleteLineItem } from '@/industries/auto-body/actions/maintenanceLineItems'
import { applyTemplateToMaintenance } from '@/industries/auto-body/actions/maintenanceTemplates'
import StagedLineItemsTable from './StagedLineItemsTable'

type Props = {
  maintenanceId: string
  canEdit:       boolean
  leverRate?:    string | null
}

export default async function MaintenanceLineItemsEditor({ maintenanceId, canEdit, leverRate }: Props) {
  const [items, templates] = await Promise.all([
    db.select().from(maintenance_line_items)
      .where(eq(maintenance_line_items.maintenance_id, maintenanceId))
      .orderBy(asc(maintenance_line_items.sort_order)),
    canEdit
      ? db.select({
          id:          maintenance_templates.id,
          name:        maintenance_templates.name,
          category:    maintenance_templates.category,
          description: maintenance_templates.description,
          lineCount:   sql<number>`(SELECT count(*)::int FROM ${maintenance_template_lines} WHERE template_id = ${maintenance_templates.id})`,
          feeCount:    sql<number>`(SELECT count(*)::int FROM ${maintenance_template_fees}  WHERE template_id = ${maintenance_templates.id})`,
        })
          .from(maintenance_templates)
          .where(eq(maintenance_templates.is_active, true))
          .orderBy(asc(maintenance_templates.sort_order), asc(maintenance_templates.name))
      : Promise.resolve([] as { id: string; name: string; category: string | null; description: string | null; lineCount: number; feeCount: number }[]),
  ])

  async function createAction(formData: FormData) {
    'use server'
    await createLineItem(maintenanceId, formData)
  }
  async function updateAction(lineId: string, formData: FormData) {
    'use server'
    await updateLineItem(maintenanceId, lineId, formData)
  }
  async function deleteAction(lineId: string) {
    'use server'
    await deleteLineItem(maintenanceId, lineId)
  }
  async function applyAction(templateId: string): Promise<{ lines: number; fees: number }> {
    'use server'
    return applyTemplateToMaintenance(templateId, maintenanceId)
  }

  return (
    <StagedLineItemsTable
      initialItems={items}
      canEdit={canEdit}
      leverRate={leverRate ?? null}
      templates={templates.map((t) => ({
        id: t.id, name: t.name, category: t.category, description: t.description,
        lineCount: Number(t.lineCount), feeCount: Number(t.feeCount),
      }))}
      createAction={createAction}
      updateAction={updateAction}
      deleteAction={deleteAction}
      applyTemplateAction={applyAction}
    />
  )
}
