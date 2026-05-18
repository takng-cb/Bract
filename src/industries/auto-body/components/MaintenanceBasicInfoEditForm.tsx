'use client'

/**
 * 整備本体（基本情報 + メモ）の編集フォーム（モーダル内で使用）。
 *
 * - 日時／場所、走行距離、拠点、入庫区分、受付/作業担当、税情報、レバーレート、3 メモ を編集
 * - 即時保存ではなく「保存」「キャンセル」を明示
 * - 顧客・車両・ステータスは別モーダル・別アクション
 */
import { useState, useTransition, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import SearchableSelect from '@/components/SearchableSelect'
import { updateMaintenanceBasicAndMemo } from '@/industries/auto-body/actions/maintenance'
import { useSectionModal } from './SectionEditModal'

export type UserOption = { id: string; name: string }

const TAX_MODES     = ['税別10%', '税別8%', '税込10%', '税込8%', '非課税']
const TAX_ROUNDINGS = ['切り捨て', '四捨五入', '切り上げ']

type State = {
  intake_date:          string
  intake_time:          string
  delivery_date:        string
  delivery_time:        string
  pickup_location:      string
  delivery_location:    string
  sales_recording_date: string
  mileage:              string
  branch_id:            string
  intake_category:      string
  reception_owner_id:   string
  worker_owner_id:      string
  internal_memo:        string
  work_order_note:      string
  general_note:         string
  tax_mode:             string
  tax_rounding:         string
  lever_rate:           string
}

/** DB から渡る初期値: 各フィールドは null を含み得る（mileage は number） */
export type MaintenanceBasicInfoInitial = {
  intake_date?:          string | null
  intake_time?:          string | null
  delivery_date?:        string | null
  delivery_time?:        string | null
  pickup_location?:      string | null
  delivery_location?:    string | null
  sales_recording_date?: string | null
  mileage?:              number | null
  branch_id?:            string | null
  intake_category?:      string | null
  reception_owner_id?:   string | null
  worker_owner_id?:      string | null
  internal_memo?:        string | null
  work_order_note?:      string | null
  general_note?:         string | null
  tax_mode?:             string | null
  tax_rounding?:         string | null
  lever_rate?:           string | null
}

type Props = {
  maintenanceId: string
  initial:       MaintenanceBasicInfoInitial
  users:         UserOption[]
}

function toStr(v: string | number | null | undefined): string {
  return v == null ? '' : String(v)
}

export default function MaintenanceBasicInfoEditForm({
  maintenanceId, initial, users,
}: Props) {
  const initialState: State = {
    intake_date:          toStr(initial.intake_date),
    intake_time:          toStr(initial.intake_time),
    delivery_date:        toStr(initial.delivery_date),
    delivery_time:        toStr(initial.delivery_time),
    pickup_location:      toStr(initial.pickup_location),
    delivery_location:    toStr(initial.delivery_location),
    sales_recording_date: toStr(initial.sales_recording_date),
    mileage:              toStr(initial.mileage),
    branch_id:            toStr(initial.branch_id),
    intake_category:      toStr(initial.intake_category),
    reception_owner_id:   toStr(initial.reception_owner_id),
    worker_owner_id:      toStr(initial.worker_owner_id),
    internal_memo:        toStr(initial.internal_memo),
    work_order_note:      toStr(initial.work_order_note),
    general_note:         toStr(initial.general_note),
    tax_mode:             toStr(initial.tax_mode) || '税別10%',
    tax_rounding:         toStr(initial.tax_rounding) || '切り捨て',
    lever_rate:           toStr(initial.lever_rate),
  }

  const [state, setState] = useState<State>(initialState)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const modal = useSectionModal()

  function set<K extends keyof State>(k: K, v: State[K]) {
    setState((s) => ({ ...s, [k]: v }))
  }

  function onInput(k: keyof State) {
    return (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      set(k, e.target.value as State[typeof k])
  }

  const dirty = (Object.keys(initialState) as (keyof State)[]).some((k) => state[k] !== initialState[k])

  function handleSave() {
    setError(null)
    const mileageNum = state.mileage.trim() === '' ? null
      : Number.isFinite(Number(state.mileage)) ? Math.trunc(Number(state.mileage))
      : null

    startTransition(async () => {
      try {
        await updateMaintenanceBasicAndMemo(maintenanceId, {
          intake_date:          state.intake_date          || null,
          intake_time:          state.intake_time          || null,
          delivery_date:        state.delivery_date        || null,
          delivery_time:        state.delivery_time        || null,
          pickup_location:      state.pickup_location      || null,
          delivery_location:    state.delivery_location    || null,
          sales_recording_date: state.sales_recording_date || null,
          mileage:              mileageNum,
          branch_id:            state.branch_id            || null,
          intake_category:      state.intake_category      || null,
          reception_owner_id:   state.reception_owner_id   || null,
          worker_owner_id:      state.worker_owner_id      || null,
          internal_memo:        state.internal_memo        || null,
          work_order_note:      state.work_order_note      || null,
          general_note:         state.general_note         || null,
          tax_mode:             state.tax_mode             || null,
          tax_rounding:         state.tax_rounding         || null,
          lever_rate:           state.lever_rate           || null,
        })
        router.refresh()
        modal?.close()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })
  }

  function handleCancel() {
    if (dirty && !confirm('変更が破棄されます。よろしいですか？')) return
    modal?.close()
  }

  const fieldCls =
    'w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500'

  return (
    <div className="flex flex-col h-full">
      {/* 本文 */}
      <div className="flex-1 overflow-y-auto space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-md">{error}</div>
        )}

        {/* 日時 */}
        <section>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">日時</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">入庫日</label>
              <input type="date" value={state.intake_date} onChange={onInput('intake_date')} className={fieldCls} />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">入庫時間</label>
              <input type="time" value={state.intake_time} onChange={onInput('intake_time')} className={fieldCls} />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">納車日</label>
              <input type="date" value={state.delivery_date} onChange={onInput('delivery_date')} className={fieldCls} />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">納車時間</label>
              <input type="time" value={state.delivery_time} onChange={onInput('delivery_time')} className={fieldCls} />
            </div>
          </div>
        </section>

        {/* 場所・距離 */}
        <section>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">場所・距離</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">引取場所</label>
              <input value={state.pickup_location} onChange={onInput('pickup_location')} className={fieldCls} />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">引渡場所</label>
              <input value={state.delivery_location} onChange={onInput('delivery_location')} className={fieldCls} />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">売上計上日</label>
              <input type="date" value={state.sales_recording_date} onChange={onInput('sales_recording_date')} className={fieldCls} />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">総走行距離 (km)</label>
              <input type="number" value={state.mileage} onChange={onInput('mileage')} min="0" className={fieldCls} />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">拠点</label>
              <input value={state.branch_id} onChange={onInput('branch_id')} placeholder="例: 本店" className={fieldCls} />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">入庫区分</label>
              <input value={state.intake_category} onChange={onInput('intake_category')} placeholder="例: 車検 / 一般整備 / 板金" className={fieldCls} />
            </div>
          </div>
        </section>

        {/* 担当 */}
        <section>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">担当</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">受付担当者</label>
              <SearchableSelect
                key={`reception-${state.reception_owner_id}`}
                name="reception_owner_id"
                defaultValue={state.reception_owner_id || undefined}
                options={users.map((u) => ({ value: u.id, label: u.name }))}
                placeholder="—"
                onSelect={(id) => set('reception_owner_id', id)}
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">作業担当者</label>
              <SearchableSelect
                key={`worker-${state.worker_owner_id}`}
                name="worker_owner_id"
                defaultValue={state.worker_owner_id || undefined}
                options={users.map((u) => ({ value: u.id, label: u.name }))}
                placeholder="—"
                onSelect={(id) => set('worker_owner_id', id)}
              />
            </div>
          </div>
        </section>

        {/* 税 */}
        <section>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">税</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">消費税区分</label>
              <select value={state.tax_mode} onChange={onInput('tax_mode')} className={`${fieldCls} bg-white`}>
                {TAX_MODES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">消費税端数</label>
              <select value={state.tax_rounding} onChange={onInput('tax_rounding')} className={`${fieldCls} bg-white`}>
                {TAX_ROUNDINGS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">レバーレート（税別）</label>
              <input type="number" value={state.lever_rate} onChange={onInput('lever_rate')} min="0" className={fieldCls} />
            </div>
          </div>
        </section>

        {/* メモ */}
        <section>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">メモ</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">
                整備メモ <span className="text-zinc-400 font-normal">（印字なし）</span>
              </label>
              <textarea value={state.internal_memo} onChange={onInput('internal_memo')} rows={2} className={`${fieldCls} resize-y`} />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">
                作業指示備考 <span className="text-zinc-400 font-normal">（作業指示書に印字）</span>
              </label>
              <textarea value={state.work_order_note} onChange={onInput('work_order_note')} rows={2} className={`${fieldCls} resize-y`} />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">
                備考 <span className="text-zinc-400 font-normal">（見積書等に印字）</span>
              </label>
              <textarea value={state.general_note} onChange={onInput('general_note')} rows={2} className={`${fieldCls} resize-y`} />
            </div>
          </div>
        </section>
      </div>

      {/* sticky フッタ */}
      <div className="sticky bottom-0 bg-white border-t border-zinc-200 mt-4 -mx-5 px-5 py-3 flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          {dirty
            ? <><span className="text-amber-700 font-semibold">●</span> 未保存の変更があります</>
            : '変更なし'}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm border border-zinc-300 rounded-md hover:bg-zinc-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={pending || !dirty}
            className="px-4 py-2 text-sm bg-amber-600 text-white font-medium rounded-md hover:bg-amber-700 disabled:opacity-50 shadow-sm"
          >
            {pending ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
