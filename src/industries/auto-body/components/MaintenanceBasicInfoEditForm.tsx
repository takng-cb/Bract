'use client'

/**
 * 整備本体（基本情報 + メモ）の編集フォーム（モーダル内で使用）。
 *
 * レイアウトは表示パネル（右側の【整備】セクション）と同じく
 *   - 基本情報は 4 列グリッド（パネルと同じ並び順）
 *   - その下にメモ 3 列
 * で揃えてある。
 *
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

// 入力欄の共通スタイル。コンポーネント外で定義することで、再レンダー時に
// 同じ参照が使い回されてフォーカスが外れない。
// 変更箇所の強調は EditableInfoCard と同じ amber（border-amber-400 + bg-amber-50）。
const FIELD_BASE =
  'w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors'
const CLEAN = 'border-zinc-300 bg-white'
const DIRTY = 'border-amber-400 bg-amber-50'

/**
 * 1 セル分の入力ラッパー。
 * ⚠️ コンポーネント関数の外で定義すること。中で定義すると毎回新しい
 * コンポーネント型として扱われ、setState のたびに input がアンマウントされて
 * フォーカスを失う（typing で 1 文字ごとにカーソルが外れる）。
 */
function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] text-zinc-500 mb-0.5">{label}</label>
      {children}
    </div>
  )
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

  // フィールド単位の変更強調（EditableInfoCard と同じ作法。REQ: 変更フィールドの色付け）
  const fieldCls = (k: keyof State) => `${FIELD_BASE} ${state[k] !== initialState[k] ? DIRTY : CLEAN}`
  const dirtyRing = (k: keyof State) => (state[k] !== initialState[k] ? 'rounded-md ring-2 ring-amber-300' : '')

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

  return (
    <div className="flex flex-col h-full">
      {/* 本文 */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-md">{error}</div>
        )}

        {/* ─── 基本情報グリッド（パネルと同じ 4 列・同じ並び順）─── */}
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-3">
            {/* Row 1: 拠点 / 入庫区分 / 入庫日 / 入庫時間 */}
            <Cell label="拠点">
              <input value={state.branch_id} onChange={onInput('branch_id')} placeholder="例: 本店" className={fieldCls('branch_id')} />
            </Cell>
            <Cell label="入庫区分">
              <input value={state.intake_category} onChange={onInput('intake_category')} placeholder="例: 車検 / 一般整備 / 板金" className={fieldCls('intake_category')} />
            </Cell>
            <Cell label="入庫日">
              <input type="date" value={state.intake_date} onChange={onInput('intake_date')} className={fieldCls('intake_date')} />
            </Cell>
            <Cell label="入庫時間">
              <input type="time" value={state.intake_time} onChange={onInput('intake_time')} className={fieldCls('intake_time')} />
            </Cell>

            {/* Row 2: 納車日 / 納車時間 / 走行距離 / 売上計上日 */}
            <Cell label="納車日">
              <input type="date" value={state.delivery_date} onChange={onInput('delivery_date')} className={fieldCls('delivery_date')} />
            </Cell>
            <Cell label="納車時間">
              <input type="time" value={state.delivery_time} onChange={onInput('delivery_time')} className={fieldCls('delivery_time')} />
            </Cell>
            <Cell label="走行距離 (km)">
              <input type="number" value={state.mileage} onChange={onInput('mileage')} min="0" className={fieldCls('mileage')} />
            </Cell>
            <Cell label="売上計上日">
              <input type="date" value={state.sales_recording_date} onChange={onInput('sales_recording_date')} className={fieldCls('sales_recording_date')} />
            </Cell>

            {/* Row 3: 引取場所 / 引渡場所 / 受付担当 / 作業担当 */}
            <Cell label="引取場所">
              <input value={state.pickup_location} onChange={onInput('pickup_location')} className={fieldCls('pickup_location')} />
            </Cell>
            <Cell label="引渡場所">
              <input value={state.delivery_location} onChange={onInput('delivery_location')} className={fieldCls('delivery_location')} />
            </Cell>
            <Cell label="受付担当">
              <div className={dirtyRing('reception_owner_id')}>
                <SearchableSelect
                  key={`reception-${state.reception_owner_id}`}
                  name="reception_owner_id"
                  defaultValue={state.reception_owner_id || undefined}
                  options={users.map((u) => ({ value: u.id, label: u.name }))}
                  placeholder="—"
                  onSelect={(id) => set('reception_owner_id', id)}
                />
              </div>
            </Cell>
            <Cell label="作業担当">
              <div className={dirtyRing('worker_owner_id')}>
                <SearchableSelect
                  key={`worker-${state.worker_owner_id}`}
                  name="worker_owner_id"
                  defaultValue={state.worker_owner_id || undefined}
                  options={users.map((u) => ({ value: u.id, label: u.name }))}
                  placeholder="—"
                  onSelect={(id) => set('worker_owner_id', id)}
                />
              </div>
            </Cell>

            {/* Row 4: 消費税区分 / 消費税端数 / レバーレート / （空） */}
            <Cell label="消費税区分">
              <select value={state.tax_mode} onChange={onInput('tax_mode')} className={fieldCls('tax_mode')}>
                {TAX_MODES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Cell>
            <Cell label="消費税端数">
              <select value={state.tax_rounding} onChange={onInput('tax_rounding')} className={fieldCls('tax_rounding')}>
                {TAX_ROUNDINGS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Cell>
            <Cell label="レバーレート（税別）">
              <input type="number" value={state.lever_rate} onChange={onInput('lever_rate')} min="0" className={fieldCls('lever_rate')} />
            </Cell>
            <div className="hidden lg:block" />{/* 4 列目を埋めるダミー */}
          </div>

          {/* メモ（パネルと同じく仕切り線下に 3 列） */}
          <div className="mt-4 pt-3 border-t border-zinc-100">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">メモ</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Cell label="整備メモ（印字なし）">
                <textarea value={state.internal_memo} onChange={onInput('internal_memo')} rows={3} className={`${fieldCls('internal_memo')} resize-y`} />
              </Cell>
              <Cell label="作業指示備考（作業指示書に印字）">
                <textarea value={state.work_order_note} onChange={onInput('work_order_note')} rows={3} className={`${fieldCls('work_order_note')} resize-y`} />
              </Cell>
              <Cell label="備考（見積書等に印字）">
                <textarea value={state.general_note} onChange={onInput('general_note')} rows={3} className={`${fieldCls('general_note')} resize-y`} />
              </Cell>
            </div>
          </div>
        </div>
      </div>

      {/* フッタ */}
      <div className="mt-4 pt-3 border-t border-zinc-200 flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          {dirty
            ? <><span className="text-blue-600 font-semibold">●</span> 未保存の変更があります</>
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
            className="px-4 py-2 text-sm bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 shadow-sm"
          >
            {pending ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
