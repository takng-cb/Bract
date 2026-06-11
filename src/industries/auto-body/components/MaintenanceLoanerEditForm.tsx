'use client'

/**
 * 代車（ローン車）の編集フォーム（モーダル内で使用）— Issue #45 Phase 2
 *
 * 代車車両は既存 vehicles テーブルを流用する。loaner_vehicle_id を
 * セット/解除すると、サーバー側で vehicles.status を '代車中' / '在庫'
 * に自動同期する（actions/maintenance.ts: updateMaintenanceLoaner）。
 *
 * 車両の選択は「検索コンボ」（REQ-0042 と同 UX）。在庫車両を
 * ナンバー / メーカー / 車種でオンデマンド検索する。
 */
import { useState, useTransition, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { SearchCombo, useDebouncedSearch } from './SearchCreateCombo'
import { findLoanerVehicleCandidates } from '@/industries/auto-body/actions/maintenanceInline'
import { updateMaintenanceLoaner } from '@/industries/auto-body/actions/maintenance'
import { useSectionModal } from './SectionEditModal'

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
  /** 現在割り当て中の代車のラベル（チップ初期表示用） */
  currentLoanerLabel: string | null
}

function toStr(v: string | number | null | undefined): string {
  return v == null ? '' : String(v)
}

// 入力欄の共通スタイル。コンポーネント外で定義することで、再レンダー時に
// 同じ参照が使い回されてフォーカスが外れない。
// 変更箇所の強調は EditableInfoCard と同じ amber（border-amber-400 + bg-amber-50）
const FIELD_BASE =
  'w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors'
const CLEAN = 'border-zinc-300 bg-white'
const DIRTY = 'border-amber-400 bg-amber-50'

/**
 * 入力 1 セル分のラベル付きラッパー。
 * ⚠️ コンポーネント関数の外で定義すること。中で定義すると毎回新しい
 * コンポーネント型として扱われ、setState のたびに input がアンマウントされて
 * フォーカスを失う。
 */
function Cell({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-[10px] text-zinc-500 mb-0.5">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-zinc-400 mt-0.5">{hint}</p>}
    </div>
  )
}

/** Date | string | null を datetime-local 入力用文字列 "YYYY-MM-DDTHH:mm" に変換 */
function toLocalDT(v: Date | string | null | undefined): string {
  if (!v) return ''
  const d = v instanceof Date ? v : new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function MaintenanceLoanerEditForm({
  maintenanceId, initial, currentLoanerLabel,
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
  const [loanerLabel, setLoanerLabel] = useState<string | null>(initial.loaner_vehicle_id ? currentLoanerLabel : null)
  const [loanerText, setLoanerText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const modal = useSectionModal()

  const { results: loanerCands, searching: loanerSearching } =
    useDebouncedSearch(loanerText, findLoanerVehicleCandidates)

  function set<K extends keyof State>(k: K, v: State[K]) {
    setState((s) => ({ ...s, [k]: v }))
  }

  function onInput(k: keyof State) {
    return (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      set(k, e.target.value as State[typeof k])
  }

  const dirty = (Object.keys(initialState) as (keyof State)[]).some((k) => state[k] !== initialState[k])

  // フィールド単位の変更強調（EditableInfoCard と同じ作法）
  const fieldCls = (k: keyof State) => `${FIELD_BASE} ${state[k] !== initialState[k] ? DIRTY : CLEAN}`
  const dirtyRing = (k: keyof State) => (state[k] !== initialState[k] ? 'rounded-md ring-2 ring-amber-300' : '')

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
    setLoanerLabel(null)
    setLoanerText('')
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

  const hasVehicleSelected = state.loaner_vehicle_id !== ''

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-md">{error}</div>
        )}

        <div>
          {/* 代車車両の選択（最重要・在庫車両をオンデマンド検索） */}
          <Cell label="代車車両" hint="ナンバー / メーカー / 車種で在庫の車両を検索。割り当てると車両ステータスが「代車中」になります。">
            <div className={dirtyRing('loaner_vehicle_id')}>
              <SearchCombo
                placeholder="例: 35-89、トヨタ、アクア"
                selectedLabel={loanerLabel}
                onClear={() => { set('loaner_vehicle_id', ''); setLoanerLabel(null) }}
                value={loanerText}
                onChange={setLoanerText}
                candidates={loanerCands}
                searching={loanerSearching}
                onPick={(id, label) => { set('loaner_vehicle_id', id); setLoanerLabel(label); setLoanerText('') }}
              />
            </div>
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
                      className={fieldCls('loaner_handover_at')}
                    />
                  </Cell>
                  <Cell label="返却日時" hint="完了/キャンセル時は自動で現在時刻が入ります（手動上書き可）">
                    <input
                      type="datetime-local"
                      value={state.loaner_return_at}
                      onChange={onInput('loaner_return_at')}
                      className={fieldCls('loaner_return_at')}
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
                      className={fieldCls('loaner_mileage_out')}
                    />
                  </Cell>
                  <Cell label="返却時メーター">
                    <input
                      type="number"
                      value={state.loaner_mileage_in}
                      onChange={onInput('loaner_mileage_in')}
                      min="0"
                      className={fieldCls('loaner_mileage_in')}
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
                      className={fieldCls('loaner_fuel_out')}
                    />
                  </Cell>
                  <Cell label="返却時燃料量">
                    <input
                      value={state.loaner_fuel_in}
                      onChange={onInput('loaner_fuel_in')}
                      placeholder="満タン"
                      className={fieldCls('loaner_fuel_in')}
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
                    className={`${fieldCls('loaner_notes')} resize-y`}
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
