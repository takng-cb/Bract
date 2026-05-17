import { db } from '@/lib/db'
import { maintenance_line_items, maintenance_templates, maintenance_template_lines, maintenance_template_fees } from '@/lib/schema'
import { eq, asc, sql } from 'drizzle-orm'
import { createLineItem, updateLineItem, deleteLineItem, toggleLineWorkStatus } from '@/industries/auto-body/actions/maintenanceLineItems'
import { applyTemplateToMaintenance } from '@/industries/auto-body/actions/maintenanceTemplates'
import LineItemRow from './LineItemRow'
import LineItemAddForm from './LineItemAddForm'
import ApplyTemplateButton from './ApplyTemplateButton'

type Props = {
  maintenanceId: string
  canEdit:       boolean
  leverRate?:    string | null  // 単価未入力時の参考表示用
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

  // 集計（除外フラグ立っていない行のみ）
  let laborSum  = 0
  let partsSum  = 0
  let costSum   = 0
  for (const it of items) {
    if (it.is_excluded) continue
    const labor = Number(it.labor_amount ?? 0)
    const qty   = Number(it.parts_qty ?? 0)
    const unit  = Number(it.parts_unit_price ?? 0)
    const cost  = Number(it.cost_unit_price ?? 0)
    if (Number.isFinite(labor)) laborSum += labor
    if (Number.isFinite(qty) && Number.isFinite(unit)) partsSum += qty * unit
    if (Number.isFinite(qty) && Number.isFinite(cost)) costSum  += qty * cost
  }
  const subtotal = laborSum + partsSum

  async function createAction(formData: FormData) {
    'use server'
    await createLineItem(maintenanceId, formData)
  }

  async function applyAction(templateId: string): Promise<{ lines: number; fees: number }> {
    'use server'
    return applyTemplateToMaintenance(templateId, maintenanceId)
  }

  return (
    <div className="space-y-4">
      {/* ヘッダー: テンプレ適用ボタン */}
      {canEdit && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-500">よくある作業セットは <span className="font-medium">整備パッケージ</span> から 1 クリックで投入できます。</p>
          <ApplyTemplateButton
            templates={templates.map((t) => ({
              id: t.id, name: t.name, category: t.category, description: t.description,
              lineCount: Number(t.lineCount), feeCount: Number(t.feeCount),
            }))}
            applyAction={applyAction}
          />
        </div>
      )}

      {items.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-lg p-8 text-center">
          <p className="text-sm text-zinc-400">作業項目はまだありません</p>
          {canEdit && <p className="text-xs text-zinc-400 mt-1">下のフォームから追加、または「テンプレを適用」してください</p>}
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100">
          {items.map((item, idx) => (
            <LineItemRow
              key={item.id}
              index={idx}
              item={item}
              canEdit={canEdit}
              updateAction={updateLineItem.bind(null, maintenanceId, item.id)}
              deleteAction={deleteLineItem.bind(null, maintenanceId, item.id)}
              toggleAction={toggleLineWorkStatus.bind(null, maintenanceId, item.id)}
            />
          ))}
        </div>
      )}

      {/* 集計（参考） */}
      {items.length > 0 && (
        <div className="bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-3">
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <dt className="text-xs text-zinc-500">工賃計（税別）</dt>
              <dd className="font-mono text-zinc-800">¥{laborSum.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">部品計（税別）</dt>
              <dd className="font-mono text-zinc-800">¥{partsSum.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">小計（税別）</dt>
              <dd className="font-mono font-semibold text-zinc-900">¥{subtotal.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">原価計</dt>
              <dd className="font-mono text-zinc-600">¥{costSum.toLocaleString()}</dd>
            </div>
          </dl>
          <p className="text-xs text-zinc-400 mt-2">
            ※除外行を除いた合計。諸費用・税は別途加算されます。
          </p>
        </div>
      )}

      {canEdit && (
        <LineItemAddForm action={createAction} leverRate={leverRate ?? null} />
      )}
    </div>
  )
}
