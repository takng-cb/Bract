'use client'

/**
 * 諸費用のステージング型編集テーブル。
 * 「保存」押下まで変更を反映しない。
 */
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useSectionModal } from './SectionEditModal'

type FeeInitial = {
  id:           string
  category:     string
  item_name:    string
  amount:       string | null
  cost_amount:  string | null
}

type RowStatus = 'unchanged' | 'edited' | 'new' | 'deleted'

type StagedRow = {
  _key:        string
  _dbId:       string | null
  _status:     RowStatus
  category:    string
  item_name:   string
  amount:      string
  cost_amount: string
}

type Props = {
  initialFees:  FeeInitial[]
  canEdit:      boolean
  createAction: (formData: FormData) => Promise<void>
  updateAction: (feeId: string, formData: FormData) => Promise<void>
  deleteAction: (feeId: string) => Promise<void>
}

function toStaged(f: FeeInitial): StagedRow {
  return {
    _key:        f.id,
    _dbId:       f.id,
    _status:     'unchanged',
    category:    f.category,
    item_name:   f.item_name,
    amount:      f.amount ?? '',
    cost_amount: f.cost_amount ?? '',
  }
}
function newRow(): StagedRow {
  return {
    _key: 'new-' + Math.random().toString(36).slice(2, 10),
    _dbId: null, _status: 'new',
    category: '課税', item_name: '', amount: '', cost_amount: '',
  }
}
function toFormData(r: StagedRow): FormData {
  const fd = new FormData()
  fd.set('category', r.category)
  fd.set('item_name', r.item_name)
  fd.set('amount', r.amount)
  fd.set('cost_amount', r.cost_amount)
  return fd
}

const cell = 'w-full bg-transparent border border-transparent rounded px-2 py-1 text-sm focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-200/50 focus:outline-none disabled:opacity-50'
const cellNum = cell + ' text-right font-mono'

export default function StagedFeesTable({ initialFees, canEdit, createAction, updateAction, deleteAction }: Props) {
  const modal = useSectionModal()
  const router = useRouter()
  const initial = useMemo(() => initialFees.map(toStaged), [initialFees])
  const [rows, setRows] = useState<StagedRow[]>(initial)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const dirtyCount = rows.filter((r) => r._status !== 'unchanged').length

  function update<K extends keyof StagedRow>(key: string, field: K, value: StagedRow[K]) {
    setRows((rs) => rs.map((r) => {
      if (r._key !== key) return r
      const ns: RowStatus = r._status === 'new' || r._status === 'deleted' ? r._status : 'edited'
      return { ...r, [field]: value, _status: ns }
    }))
  }
  function toggleDelete(key: string) {
    setRows((rs) => {
      const t = rs.find((r) => r._key === key)
      if (!t) return rs
      if (t._status === 'new') return rs.filter((r) => r._key !== key)
      return rs.map((r) => r._key === key ? { ...r, _status: r._status === 'deleted' ? 'unchanged' : 'deleted' } : r)
    })
  }
  function addRow() {
    setRows((rs) => [...rs, newRow()])
  }

  let taxable = 0, nonTaxable = 0, costSum = 0
  for (const r of rows) {
    if (r._status === 'deleted') continue
    const a = Number(r.amount); const c = Number(r.cost_amount)
    if (Number.isFinite(a)) {
      if (r.category === '非課税') nonTaxable += a
      else taxable += a
    }
    if (Number.isFinite(c)) costSum += c
  }
  const total = taxable + nonTaxable

  async function handleSave() {
    setError(null)
    const ops: Array<() => Promise<void>> = []
    for (const r of rows) {
      if (r._status === 'new') {
        if (!r.item_name.trim()) continue
        ops.push(() => createAction(toFormData(r)))
      } else if (r._status === 'edited' && r._dbId) {
        ops.push(() => updateAction(r._dbId!, toFormData(r)))
      } else if (r._status === 'deleted' && r._dbId) {
        ops.push(() => deleteAction(r._dbId!))
      }
    }
    if (ops.length === 0) { modal?.close(); return }
    startTransition(async () => {
      try {
        for (const op of ops) await op()
        router.refresh()
        modal?.close()
      } catch (e) { setError((e as Error).message) }
    })
  }

  function handleCancel() {
    if (dirtyCount > 0 && !confirm(`未保存の変更が ${dirtyCount} 件あります。破棄して閉じますか？`)) return
    setRows(initial)
    modal?.close()
  }

  return (
    <div className="flex flex-col gap-2">
      {canEdit && (
        <p className="text-xs text-zinc-500">
          セルを直接編集 → <strong className="text-blue-600">「保存」</strong> で確定。
        </p>
      )}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>
      )}

      <div className="bg-white border border-zinc-200 rounded-lg overflow-x-auto">
        <div className="min-w-[600px]">
          <div className="grid grid-cols-[4.5rem_5rem_minmax(0,1fr)_6rem_6rem] gap-1 px-2 py-1.5 bg-zinc-50 border-b-2 border-zinc-200 text-[11px] font-semibold text-zinc-700 [&>div]:px-2">
            <div className="text-center">削除 / #</div>
            <div>区分</div>
            <div>項目名</div>
            <div className="text-right">金額</div>
            <div className="text-right">原価</div>
          </div>

          {rows.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-zinc-400 border-b border-zinc-100">
              諸費用はまだありません。下の「＋ 行を追加」から作成してください。
            </div>
          ) : (
            rows.map((r, idx) => {
              const cls =
                r._status === 'deleted' ? 'opacity-50 bg-rose-50/50 line-through' :
                r._status === 'edited'  ? 'bg-zinc-50/40' :
                r._status === 'new'     ? 'bg-emerald-50/30 border-l-4 border-emerald-400' :
                                          'hover:bg-zinc-50/20'
              return (
                <div key={r._key} className={`grid grid-cols-[4.5rem_5rem_minmax(0,1fr)_6rem_6rem] items-center gap-1 px-2 py-1 border-b border-zinc-100 ${cls}`}>
                  <div className="flex items-center gap-1">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => toggleDelete(r._key)}
                        className={r._status === 'deleted'
                          ? 'w-7 h-7 inline-flex items-center justify-center rounded text-blue-600 hover:text-blue-800 hover:bg-zinc-50 text-xs'
                          : 'w-7 h-7 inline-flex items-center justify-center rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-rose-200'}
                        title={r._status === 'deleted' ? '削除を取り消す' : 'この行を削除'}
                      >
                        {r._status === 'deleted' ? '↩' : '🗑'}
                      </button>
                    )}
                    <div className="text-xs text-zinc-400 font-mono text-center flex-1">{r._status === 'new' ? '＋' : idx + 1}</div>
                  </div>
                  <select
                    value={r.category}
                    onChange={(e) => update(r._key, 'category', e.target.value)}
                    disabled={!canEdit || r._status === 'deleted'}
                    className={`${cell} bg-white`}
                  >
                    <option value="課税">課税</option>
                    <option value="非課税">非課税</option>
                  </select>
                  <input value={r.item_name} onChange={(e) => update(r._key, 'item_name', e.target.value)} placeholder="項目名" required disabled={!canEdit || r._status === 'deleted'} className={cell} />
                  <input type="number" min="0" value={r.amount} onChange={(e) => update(r._key, 'amount', e.target.value)} placeholder="金額" disabled={!canEdit || r._status === 'deleted'} className={cellNum} />
                  <input type="number" min="0" value={r.cost_amount} onChange={(e) => update(r._key, 'cost_amount', e.target.value)} placeholder="原価" disabled={!canEdit || r._status === 'deleted'} className={cellNum} />
                </div>
              )
            })
          )}

          {canEdit && (
            <button
              type="button"
              onClick={addRow}
              disabled={pending}
              className="w-full text-center py-2 border-t-2 border-dashed border-zinc-200 bg-zinc-50/30 text-sm text-blue-600 hover:bg-zinc-50 hover:text-blue-800 disabled:opacity-50"
            >
              ＋ 行を追加
            </button>
          )}

          {rows.filter((r) => r._status !== 'deleted').length > 0 && (
            <div className="grid grid-cols-[4.5rem_5rem_minmax(0,1fr)_6rem_6rem] gap-1 px-2 py-2 bg-zinc-50 border-t-2 border-zinc-300 text-sm [&>div]:px-2">
              <div></div>
              <div></div>
              <div className="text-right text-xs text-zinc-600">
                <span className="mr-3">課税計 <span className="font-mono">¥{taxable.toLocaleString()}</span></span>
                <span className="mr-3">非課税計 <span className="font-mono">¥{nonTaxable.toLocaleString()}</span></span>
                <span>合計</span>
              </div>
              <div className="text-right font-mono font-bold text-zinc-900">¥{total.toLocaleString()}</div>
              <div className="text-right text-xs text-zinc-500 font-mono">¥{costSum.toLocaleString()}</div>
            </div>
          )}
        </div>
      </div>

      {canEdit && (
        <div className="sticky bottom-0 -mx-5 -mb-5 px-5 py-3 bg-zinc-50 border-t border-zinc-200 flex items-center justify-end gap-2 mt-2">
          {dirtyCount > 0 && (
            <p className="text-xs text-blue-600 mr-auto">未保存の変更: <strong>{dirtyCount}</strong> 件</p>
          )}
          <button type="button" onClick={handleCancel} disabled={pending} className="px-4 py-1.5 text-sm border border-zinc-300 rounded-md hover:bg-zinc-50 disabled:opacity-50">キャンセル</button>
          <button type="button" onClick={handleSave} disabled={pending || dirtyCount === 0} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm disabled:opacity-50">
            {pending ? '保存中…' : '保存'}
          </button>
        </div>
      )}
    </div>
  )
}
