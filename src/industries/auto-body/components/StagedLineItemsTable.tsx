'use client'

/**
 * 作業項目（line items）のステージング型編集テーブル。
 *
 * - 全変更（編集・追加・削除）はクライアント state に蓄積
 * - 「保存」ボタンで一括コミット（順次 server action 実行）→ モーダル閉じる
 * - 「キャンセル」ボタンで全変更を破棄 → モーダル閉じる
 * - 視覚化:
 *     編集中 = 黄背景
 *     削除予定 = 赤い取り消し線（解除可能）
 *     新規行 = オレンジ縁
 */
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useSectionModal } from './SectionEditModal'
import ApplyTemplateButton from './ApplyTemplateButton'

type LineItemInitial = {
  id:                string
  work_category:     string | null
  item_name:         string | null
  hours:             string | null
  labor_amount:      string | null
  parts_qty:         string | null
  parts_unit:        string | null
  parts_unit_price:  string | null
  cost_unit_price:   string | null
  note:              string | null
  state:             string | null
  is_excluded:       boolean
  work_status:       string
}

type RowStatus = 'unchanged' | 'edited' | 'new' | 'deleted'

type StagedRow = {
  _key:             string             // React の key（既存は id、新規は temp-uuid）
  _dbId:            string | null      // null=新規、それ以外は既存 id
  _status:          RowStatus
  work_category:    string
  item_name:        string
  hours:            string
  labor_amount:     string
  parts_qty:        string
  parts_unit:       string
  parts_unit_price: string
  cost_unit_price:  string
  note:             string
  state:            string
  is_excluded:      boolean
  work_status:      string
}

type TemplateOption = {
  id: string
  name: string
  category: string | null
  description: string | null
  lineCount: number
  feeCount: number
}

type Props = {
  initialItems:  LineItemInitial[]
  canEdit:       boolean
  leverRate?:    string | null
  templates:     TemplateOption[]
  createAction:  (formData: FormData) => Promise<void>
  updateAction:  (lineId: string, formData: FormData) => Promise<void>
  deleteAction:  (lineId: string) => Promise<void>
  applyTemplateAction: (templateId: string) => Promise<{ lines: number; fees: number }>
}

function toStaged(it: LineItemInitial): StagedRow {
  return {
    _key:             it.id,
    _dbId:            it.id,
    _status:          'unchanged',
    work_category:    it.work_category ?? '',
    item_name:        it.item_name ?? '',
    hours:            it.hours ?? '',
    labor_amount:     it.labor_amount ?? '',
    parts_qty:        it.parts_qty ?? '',
    parts_unit:       it.parts_unit ?? '',
    parts_unit_price: it.parts_unit_price ?? '',
    cost_unit_price:  it.cost_unit_price ?? '',
    note:             it.note ?? '',
    state:            it.state ?? '',
    is_excluded:      it.is_excluded,
    work_status:      it.work_status,
  }
}

function newBlankRow(): StagedRow {
  return {
    _key:             'new-' + Math.random().toString(36).slice(2, 10),
    _dbId:            null,
    _status:          'new',
    work_category:    '',
    item_name:        '',
    hours:            '',
    labor_amount:     '',
    parts_qty:        '',
    parts_unit:       '',
    parts_unit_price: '',
    cost_unit_price:  '',
    note:             '',
    state:            '',
    is_excluded:      false,
    work_status:      '未完了',
  }
}

function toFormData(r: StagedRow): FormData {
  const fd = new FormData()
  fd.set('work_category', r.work_category)
  fd.set('item_name', r.item_name)
  fd.set('hours', r.hours)
  fd.set('labor_amount', r.labor_amount)
  fd.set('parts_qty', r.parts_qty)
  fd.set('parts_unit', r.parts_unit)
  fd.set('parts_unit_price', r.parts_unit_price)
  fd.set('cost_unit_price', r.cost_unit_price)
  fd.set('note', r.note)
  fd.set('state', r.state)
  fd.set('work_status', r.work_status)
  if (r.is_excluded) fd.set('is_excluded', 'on')
  return fd
}

const cell = 'w-full bg-transparent border border-transparent rounded px-2 py-1 text-sm focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-200/50 focus:outline-none disabled:opacity-50'
const cellNum = cell + ' text-right font-mono'

function yen(n: number): string {
  return `¥${Math.round(n).toLocaleString()}`
}

export default function StagedLineItemsTable({
  initialItems, canEdit, leverRate, templates,
  createAction, updateAction, deleteAction, applyTemplateAction,
}: Props) {
  const modal = useSectionModal()
  const router = useRouter()
  const initial = useMemo(() => initialItems.map(toStaged), [initialItems])
  const [rows, setRows] = useState<StagedRow[]>(initial)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const dirtyCount = rows.filter((r) => r._status !== 'unchanged').length

  function mark(key: string, status: RowStatus) {
    setRows((rs) => rs.map((r) => r._key === key ? { ...r, _status: status } : r))
  }
  function update<K extends keyof StagedRow>(key: string, field: K, value: StagedRow[K]) {
    setRows((rs) => rs.map((r) => {
      if (r._key !== key) return r
      const nextStatus: RowStatus = r._status === 'new' || r._status === 'deleted' ? r._status : 'edited'
      return { ...r, [field]: value, _status: nextStatus }
    }))
  }
  function toggleDelete(key: string) {
    setRows((rs) => {
      const target = rs.find((r) => r._key === key)
      if (!target) return rs
      // 新規行を「削除」したら state から除去
      if (target._status === 'new') return rs.filter((r) => r._key !== key)
      // 既存行: 削除予定 ↔ unchanged/edited 切替
      return rs.map((r) => r._key === key
        ? { ...r, _status: r._status === 'deleted' ? 'unchanged' : 'deleted' }
        : r)
    })
  }
  function addRow() {
    setRows((rs) => [...rs, newBlankRow()])
  }

  // 集計（削除予定 / 除外を除く）
  let laborSum = 0, partsSum = 0, costSum = 0
  for (const r of rows) {
    if (r._status === 'deleted' || r.is_excluded) continue
    const lb = Number(r.labor_amount); const qt = Number(r.parts_qty)
    const un = Number(r.parts_unit_price); const ct = Number(r.cost_unit_price)
    if (Number.isFinite(lb)) laborSum += lb
    if (Number.isFinite(qt) && Number.isFinite(un)) partsSum += qt * un
    if (Number.isFinite(qt) && Number.isFinite(ct)) costSum += qt * ct
  }
  const subtotal = laborSum + partsSum

  async function handleSave() {
    setError(null)
    const ops: Array<() => Promise<void>> = []
    for (const r of rows) {
      if (r._status === 'new') {
        if (!r.item_name.trim()) continue  // 空の新規行はスキップ
        ops.push(() => createAction(toFormData(r)))
      } else if (r._status === 'edited' && r._dbId) {
        ops.push(() => updateAction(r._dbId!, toFormData(r)))
      } else if (r._status === 'deleted' && r._dbId) {
        ops.push(() => deleteAction(r._dbId!))
      }
    }
    if (ops.length === 0) {
      modal?.close()
      return
    }
    startTransition(async () => {
      try {
        for (const op of ops) await op()
        router.refresh()
        modal?.close()
      } catch (e) {
        setError((e as Error).message)
      }
    })
  }

  function handleCancel() {
    if (dirtyCount > 0) {
      if (!confirm(`未保存の変更が ${dirtyCount} 件あります。破棄して閉じますか？`)) return
    }
    setRows(initial)
    modal?.close()
  }

  // テンプレ適用は即時実行（ステージングしない — 既存行追加なので破壊なし）
  async function handleApply(templateId: string): Promise<{ lines: number; fees: number }> {
    const r = await applyTemplateAction(templateId)
    router.refresh()
    // テンプレ適用後は state を refresh（initialItems は親で再フェッチされる）
    // 注: 同一 mount 内で state は initial に同期されないので、保存後 / リフレッシュで反映
    return r
  }

  return (
    <div className="flex flex-col gap-2">
      {/* 上部: ヒント + テンプレ */}
      {canEdit && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs text-zinc-500">
            セルを直接編集 → <strong className="text-amber-700">「保存」</strong> で確定。{leverRate && (
              <span className="ml-1 text-zinc-400">レバーレート: ¥{Number(leverRate).toLocaleString()}/h</span>
            )}
          </p>
          <ApplyTemplateButton templates={templates} applyAction={handleApply} />
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>
      )}

      {/* 表 */}
      <div className="bg-white border border-zinc-200 rounded-lg overflow-x-auto">
        <div className="min-w-[1100px]">
          {/* ヘッダ */}
          <div className="grid grid-cols-[4.5rem_5rem_minmax(0,1fr)_4rem_6rem_4rem_4rem_6rem_6rem_5rem_3.5rem] gap-1 px-2 py-1.5 bg-amber-50 border-b-2 border-amber-200 text-[11px] font-semibold text-amber-900">
            <div className="text-center">削除 / #</div>
            <div>区分</div>
            <div>作業項目名</div>
            <div className="text-right">工数</div>
            <div className="text-right">工賃</div>
            <div className="text-right">数</div>
            <div>単位</div>
            <div className="text-right">部品単価</div>
            <div className="text-right">小計</div>
            <div className="text-center">完了</div>
            <div className="text-center">除外</div>
          </div>

          {rows.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-zinc-400 border-b border-zinc-100">
              作業項目はまだありません。下の「＋ 行を追加」から作成してください。
            </div>
          ) : (
            rows.map((r, idx) => {
              const lb = Number(r.labor_amount); const qt = Number(r.parts_qty); const un = Number(r.parts_unit_price)
              const sub = (Number.isFinite(lb) ? lb : 0) + (Number.isFinite(qt) && Number.isFinite(un) ? qt * un : 0)
              const rowClass =
                r._status === 'deleted' ? 'opacity-50 bg-rose-50/50 line-through' :
                r._status === 'edited'  ? 'bg-amber-50/40' :
                r._status === 'new'     ? 'bg-emerald-50/30 border-l-4 border-emerald-400' :
                                          'hover:bg-amber-50/20'
              return (
                <div
                  key={r._key}
                  className={`grid grid-cols-[4.5rem_5rem_minmax(0,1fr)_4rem_6rem_4rem_4rem_6rem_6rem_5rem_3.5rem] items-center gap-1 px-2 py-1 border-b border-zinc-100 ${rowClass} ${r.is_excluded ? 'opacity-60' : ''}`}
                >
                  {/* 削除ボタン + 行番号 */}
                  <div className="flex items-center gap-1">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => toggleDelete(r._key)}
                        className={r._status === 'deleted'
                          ? 'w-7 h-7 inline-flex items-center justify-center rounded text-amber-600 hover:text-amber-800 hover:bg-amber-50 text-xs'
                          : 'w-7 h-7 inline-flex items-center justify-center rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-rose-200'}
                        title={r._status === 'deleted' ? '削除を取り消す' : 'この行を削除'}
                      >
                        {r._status === 'deleted' ? '↩' : '🗑'}
                      </button>
                    )}
                    <div className="text-xs text-zinc-400 font-mono text-center flex-1">
                      {r._status === 'new' ? '＋' : idx + 1}
                    </div>
                  </div>
                  <input
                    value={r.work_category}
                    onChange={(e) => update(r._key, 'work_category', e.target.value)}
                    placeholder="区分"
                    disabled={!canEdit || r._status === 'deleted'}
                    className={cell}
                  />
                  <input
                    value={r.item_name}
                    onChange={(e) => update(r._key, 'item_name', e.target.value)}
                    placeholder="作業項目名"
                    required
                    disabled={!canEdit || r._status === 'deleted'}
                    className={cell}
                  />
                  <input
                    type="number"
                    step="0.1"
                    value={r.hours}
                    onChange={(e) => update(r._key, 'hours', e.target.value)}
                    disabled={!canEdit || r._status === 'deleted'}
                    className={cellNum}
                  />
                  <input
                    type="number"
                    min="0"
                    value={r.labor_amount}
                    onChange={(e) => update(r._key, 'labor_amount', e.target.value)}
                    disabled={!canEdit || r._status === 'deleted'}
                    className={cellNum}
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={r.parts_qty}
                    onChange={(e) => update(r._key, 'parts_qty', e.target.value)}
                    disabled={!canEdit || r._status === 'deleted'}
                    className={cellNum}
                  />
                  <input
                    value={r.parts_unit}
                    onChange={(e) => update(r._key, 'parts_unit', e.target.value)}
                    placeholder="単位"
                    disabled={!canEdit || r._status === 'deleted'}
                    className={cell}
                  />
                  <input
                    type="number"
                    min="0"
                    value={r.parts_unit_price}
                    onChange={(e) => update(r._key, 'parts_unit_price', e.target.value)}
                    disabled={!canEdit || r._status === 'deleted'}
                    className={cellNum}
                  />
                  <div className="text-right font-mono text-sm font-semibold text-zinc-800 px-2">
                    {yen(sub)}
                  </div>
                  <div className="flex items-center justify-center">
                    {canEdit && r._status !== 'deleted' ? (
                      <button
                        type="button"
                        onClick={() => update(r._key, 'work_status', r.work_status === '完了' ? '未完了' : '完了')}
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center text-xs ${
                          r.work_status === '完了'
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-zinc-300 hover:border-emerald-400'
                        }`}
                      >
                        {r.work_status === '完了' ? '✓' : ''}
                      </button>
                    ) : (
                      <span className={`w-6 h-6 inline-flex items-center justify-center rounded border-2 ${r.work_status === '完了' ? 'bg-emerald-600 border-emerald-600 text-white text-xs' : 'border-zinc-200'}`}>
                        {r.work_status === '完了' ? '✓' : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-center" title="集計対象外（金額計算から除く）">
                    <input
                      type="checkbox"
                      checked={r.is_excluded}
                      onChange={(e) => update(r._key, 'is_excluded', e.target.checked)}
                      disabled={!canEdit || r._status === 'deleted'}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </div>
                </div>
              )
            })
          )}

          {/* 「＋ 行を追加」ボタン行 */}
          {canEdit && (
            <button
              type="button"
              onClick={addRow}
              disabled={pending}
              className="w-full text-center py-2 border-t-2 border-dashed border-amber-200 bg-amber-50/30 text-sm text-amber-700 hover:bg-amber-50 hover:text-amber-900 disabled:opacity-50"
            >
              ＋ 行を追加
            </button>
          )}

          {/* 合計 */}
          {rows.filter((r) => r._status !== 'deleted').length > 0 && (
            <div className="grid grid-cols-[4.5rem_5rem_minmax(0,1fr)_4rem_6rem_4rem_4rem_6rem_6rem_5rem_3.5rem] gap-1 px-2 py-2 bg-zinc-50 border-t-2 border-zinc-300 text-sm">
              <div></div>
              <div></div>
              <div className="text-right text-xs text-zinc-600 font-medium">合計</div>
              <div></div>
              <div className="text-right font-mono">{yen(laborSum)}</div>
              <div></div>
              <div></div>
              <div className="text-right font-mono">{yen(partsSum)}</div>
              <div className="text-right font-mono font-bold text-zinc-900">{yen(subtotal)}</div>
              <div></div>
              <div className="text-right text-[10px] text-zinc-500">原価<br/><span className="font-mono">{yen(costSum)}</span></div>
            </div>
          )}
        </div>
      </div>

      <p className="text-[11px] text-zinc-400">
        ※ 集計は「除外」「削除予定」を除いて算出。諸費用・税は別途加算。
      </p>

      {/* sticky フッタ: 保存 / キャンセル */}
      {canEdit && (
        <div className="sticky bottom-0 -mx-5 -mb-5 px-5 py-3 bg-zinc-50 border-t border-zinc-200 flex items-center justify-end gap-2 mt-2">
          {dirtyCount > 0 && (
            <p className="text-xs text-amber-700 mr-auto">
              未保存の変更: <strong>{dirtyCount}</strong> 件
            </p>
          )}
          <button
            type="button"
            onClick={handleCancel}
            disabled={pending}
            className="px-4 py-1.5 text-sm border border-zinc-300 rounded-md hover:bg-zinc-50 disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={pending || dirtyCount === 0}
            className="px-4 py-1.5 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 shadow-sm disabled:opacity-50"
          >
            {pending ? '保存中…' : '保存'}
          </button>
        </div>
      )}
    </div>
  )
}
