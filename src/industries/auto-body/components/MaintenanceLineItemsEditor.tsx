/**
 * 作業項目（行アイテム）の表形式編集 UI。
 *
 * - 全行が常に編集可能（input がそのままセル）
 * - blur / Enter で自動保存（変更があった行のみ）
 * - 新規行は表の末尾、合計の **前** に常駐
 * - 合計（工賃計・部品計・小計・原価計）は表の最下部
 *
 * これは CarRide ライクなスプレッドシート風 UI の意図。
 */
import { db } from '@/lib/db'
import { maintenance_line_items, maintenance_templates, maintenance_template_lines, maintenance_template_fees } from '@/lib/schema'
import { eq, asc, sql } from 'drizzle-orm'
import { createLineItem, updateLineItem, deleteLineItem, toggleLineWorkStatus } from '@/industries/auto-body/actions/maintenanceLineItems'
import { applyTemplateToMaintenance } from '@/industries/auto-body/actions/maintenanceTemplates'
import LineItemRow from './LineItemRow'
import LineItemAddRow from './LineItemAddRow'
import ApplyTemplateButton from './ApplyTemplateButton'

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

  // 集計
  let laborSum = 0, partsSum = 0, costSum = 0
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
    <div className="space-y-2">
      {/* ヘッダー */}
      {canEdit && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-500">
            セルをクリックで編集 → フォーカスを外す（Tab / Enter）で保存。{leverRate && (
              <span className="ml-1 text-zinc-400">レバーレート: ¥{Number(leverRate).toLocaleString()}/h</span>
            )}
          </p>
          <ApplyTemplateButton
            templates={templates.map((t) => ({
              id: t.id, name: t.name, category: t.category, description: t.description,
              lineCount: Number(t.lineCount), feeCount: Number(t.feeCount),
            }))}
            applyAction={applyAction}
          />
        </div>
      )}

      {/* 表（ヘッダ + 行 + 新規行 + 合計） */}
      <div className="bg-white border border-zinc-200 rounded-lg overflow-x-auto">
        <div className="min-w-[1100px]">
          {/* テーブルヘッダ */}
          <div className="grid grid-cols-[2rem_5rem_minmax(0,1fr)_4rem_6rem_4rem_4rem_6rem_6rem_5rem_6rem] gap-1 px-2 py-1.5 bg-amber-50 border-b-2 border-amber-200 text-[11px] font-semibold text-amber-900">
            <div className="text-center">#</div>
            <div>区分</div>
            <div>作業項目名</div>
            <div className="text-right">工数</div>
            <div className="text-right">工賃</div>
            <div className="text-right">数</div>
            <div>単位</div>
            <div className="text-right">部品単価</div>
            <div className="text-right">小計</div>
            <div className="text-center">完了</div>
            <div className="text-right">操作</div>
          </div>

          {/* データ行 */}
          {items.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-zinc-400 border-b border-zinc-100">
              作業項目はまだありません。下の行から追加してください。
            </div>
          ) : (
            items.map((item, idx) => (
              <LineItemRow
                key={item.id}
                index={idx}
                item={item}
                canEdit={canEdit}
                updateAction={updateLineItem.bind(null, maintenanceId, item.id)}
                deleteAction={deleteLineItem.bind(null, maintenanceId, item.id)}
                toggleAction={toggleLineWorkStatus.bind(null, maintenanceId, item.id)}
              />
            ))
          )}

          {/* 新規行（合計の上） */}
          {canEdit && <LineItemAddRow action={createAction} />}

          {/* 合計行 */}
          {items.length > 0 && (
            <div className="grid grid-cols-[2rem_5rem_minmax(0,1fr)_4rem_6rem_4rem_4rem_6rem_6rem_5rem_6rem] gap-1 px-2 py-2 bg-zinc-50 border-t-2 border-zinc-300 text-sm">
              <div></div>
              <div></div>
              <div className="text-right text-xs text-zinc-600 font-medium">合計</div>
              <div></div>
              <div className="text-right font-mono">¥{laborSum.toLocaleString()}</div>
              <div></div>
              <div></div>
              <div className="text-right font-mono">¥{partsSum.toLocaleString()}</div>
              <div className="text-right font-mono font-bold text-zinc-900">¥{subtotal.toLocaleString()}</div>
              <div></div>
              <div className="text-right text-xs text-zinc-500">原価 ¥{costSum.toLocaleString()}</div>
            </div>
          )}
        </div>
      </div>

      <p className="text-[11px] text-zinc-400">
        ※ 集計は「除外」チェックされた行を除いて算出。諸費用・税は別途加算。
      </p>
    </div>
  )
}
