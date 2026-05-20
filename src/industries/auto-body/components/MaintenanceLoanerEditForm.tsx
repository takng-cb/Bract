'use client'

/**
 * 代車（ローン車）の編集フォーム（モーダル内で使用）— Issue #45 Phase 2
 *
 * 代車車両は既存 vehicles テーブルを流用する。loaner_vehicle_id を
 * セット/解除すると、サーバー側で vehicles.status を '代車中' / '在庫'
 * に自動同期する（actions/maintenance.ts: updateMaintenanceLoaner）。
 *
 * 候補車両:
 *   - status='在庫' の車両（貸出可能）
 *   - 現在この整備に割り当て中の車両（リストから消えないようにする）
 */
import { useState, useTransition, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import SearchableSelect from '@/components/SearchableSelect'
import { updateMaintenanceLoaner } from '@/industries/auto-body/actions/maintenance'
import { useSectionModal } from './SectionEditModal'

export type LoanerVehicleOption = {
  id:            string
  maker:         string
  model:         string
  license_plate: string | null
  status:        string
}

type State = {
  loaner_vehicle_id:   string
  loaner_handover_at:  string  // datetime-local
  loaner_return_at:    string
  loaner_mileage_out:  string
  loaner_mileage_in:   string
  loaner_fuel_out:     string
  loaner_fuel_in:      string
  loaner_notes:        string
}

export type MaintenanceLoanerInitial = {
  loaner_vehicle_id?:   string | null
  loaner_handover_at?:  Date | string | null
  loaner_return_at?:    Date | string | null
  loaner_mileage_out?:  number | null
  loaner_mileage_in?:   number | null
  loaner_fuel_out?:     string | null
  loaner_fuel_in?:      string | null
  loaner_notes?:        string | null
}

type Props = {
  maintenanceId: string
  initial:       MaintenanceLoanerInitial
  vehicles:      LoanerVehicleOption[]
}

function toStr(v: string | number | null | undefined): string {
  return v == null ? '' : String(v)
}

/** Date | string | null を datetime-local 入力用文字列 "YYYY-MM-DDTHH:mm" に変換 */
function toLocalDT(v: Date | string | null | undefined): string {
  if (!v) return ''
  const d = v instanceof Date ? v : new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatVehicleLabel(v: LoanerVehicleOption): string {
  const plate = v.license_plate ?? '—'
  const name  = [v.maker, v.model].filter(Boolean).join(' ') || '車両'
  return `${plate} / ${name}`
}

export default function MaintenanceLoanerEditForm({
  maintenanceId, initial, vehicles,
}: Props) {
  const initialState: State = {
    loaner_vehicle_id:   toStr(initial.loaner_vehicle_id),
    loaner_handover_at:  toLocalDT(initial.loaner_handover_at),
    loaner_return_at:    toLocalDT(initial.loaner_return_at),
    loaner_mileage_out:  toStr(initial.loaner_mileage_out),
    loaner_mileage_in:   toStr(initial.loaner_mileage_in),
    loaner_fuel_out:     toStr(initial.loaner_fuel_out),
    loaner_fuel_in:      toStr(initial.loaner_fuel_in),
    loaner_notes:        toStr(initial.loaner_notes),
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

  function parseIntOrNull(s: string): number | null {
    const t = s.trim()
    if (t === '') return null
    const n = Number(t)
    return Number.isFinite(n) ? Math.trunc(n) : null
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      try {
        await updateMaintenanceLoaner(maintenanceId, {
          loaner_vehicle_id:   state.loaner_vehicle_id   || null,
          loaner_handover_at:  state.loaner_handover_at  || null,
          loaner_return_at:    state.loaner_return_at    || null,
          loaner_mileage_out:  parseIntOrNull(state.loaner_mileage_out),
          loaner_mileage_in:   parseIntOrNull(state.loaner_mileage_in),
          loaner_fuel_out:     state.loaner_fuel_out     || null,
          loaner_fuel_in:      state.loaner_fuel_in      || null,
          loaner_notes:        state.loaner_notes        || null,
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

  function handleClear() {
    if (!confirm('代車の割り当てを解除します。よろしいですか？\n（車両ステータスは「在庫」に戻ります）')) return
    setState({
      loaner_vehicle_id:   '',
      loaner_handover_at:  '',
      loaner_return_at:    '',
      loaner_mileage_out:  '',
      loaner_mileage_in:   '',
      loaner_fuel_out:     '',
      loaner_fuel_in:      '',
      loaner_notes:        '',
    })
  }

  const fieldCls =
    'w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  function Cell({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
    return (
      <div>
        <label className="block text-[10px] text-zinc-500 mb-0.5">{label}</label>
        {children}
        {hint && <p className="text-[10px] text-zinc-400 mt-0.5">{hint}</p>}
      </div>
    )
  }

  const hasVehicleSelected = state.loaner_vehicle_id !== ''

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-md">{error}</div>
        )}

        <section className="bg-white border border-zinc-200 rounded-lg p-4">
          {/* 代車車両の選択（最重要） */}
          <Cell label="代車車両" hint="在庫の車両から選択。割り当てると車両ステータスが「代車中」になります。">
            <SearchableSelect
              key={`loaner-${state.loaner_vehicle_id}`}
              name="loaner_vehicle_id"
              defaultValue={state.loaner_vehicle_id || undefined}
              options={vehicles.map((v) => ({ value: v.id, label: formatVehicleLabel(v) }))}
              placeholder="貸出可能な車両から選択"
              onSelect={(id) => set('loaner_vehicle_id', id)}
            />
          </Cell>

          {hasVehicleSelected && (
            <>
              {/* 貸出 / 返却 日時 */}
              <div className="mt-4 pt-3 border-t border-zinc-100">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">貸出・返却</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Cell label="貸出日時">
                    <input
                      type="datetime-local"
                      value={state.loaner_handover_at}
                      onChange={onInput('loaner_handover_at')}
                      className={fieldCls}
                    />
                  </Cell>
                  <Cell label="返却日時" hint="完了/キャンセル時は自動で現在時刻が入ります（手動上書き可）">
                    <input
                      type="datetime-local"
                      value={state.loaner_return_at}
                      onChange={onInput('loaner_return_at')}
                      className={fieldCls}
                    />
                  </Cell>
                </div>
              </div>

              {/* 走行距離 */}
              <div className="mt-4 pt-3 border-t border-zinc-100">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">走行距離（km）</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Cell label="貸出時メーター">
                    <input
                      type="number"
                      value={state.loaner_mileage_out}
                      onChange={onInput('loaner_mileage_out')}
                      min="0"
                      className={fieldCls}
                    />
                  </Cell>
                  <Cell label="返却時メーター">
                    <input
                      type="number"
                      value={state.loaner_mileage_in}
                      onChange={onInput('loaner_mileage_in')}
                      min="0"
                      className={fieldCls}
                    />
                  </Cell>
                </div>
              </div>

              {/* 燃料量 */}
              <div className="mt-4 pt-3 border-t border-zinc-100">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">燃料</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Cell label="貸出時燃料量" hint="例: 満タン / 半分 / 1/4">
                    <input
                      value={state.loaner_fuel_out}
                      onChange={onInput('loaner_fuel_out')}
                      placeholder="満タン"
                      className={fieldCls}
                    />
                  </Cell>
                  <Cell label="返却時燃料量">
                    <input
                      value={state.loaner_fuel_in}
                      onChange={onInput('loaner_fuel_in')}
                      placeholder="満タン"
                      className={fieldCls}
                    />
                  </Cell>
                </div>
              </div>

              {/* メモ */}
              <div className="mt-4 pt-3 border-t border-zinc-100">
                <Cell label="メモ（代車に関する注意事項・受け渡し時の状態など）">
                  <textarea
                    value={state.loaner_notes}
                    onChange={onInput('loaner_notes')}
                    rows={3}
                    className={`${fieldCls} resize-y`}
                  />
                </Cell>
              </div>

              {/* 解除ボタン */}
              <div className="mt-4 pt-3 border-t border-zinc-100 text-right">
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs text-rose-600 hover:text-rose-700 hover:underline"
                >
                  代車の割り当てを解除する
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      {/* sticky フッタ */}
      <div className="sticky bottom-0 bg-white border-t border-zinc-200 mt-4 -mx-5 px-5 py-3 flex items-center justify-between">
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
