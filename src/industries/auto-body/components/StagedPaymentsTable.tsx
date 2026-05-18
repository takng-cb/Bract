'use client'

/**
 * 入金のステージング型編集テーブル。
 */
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useSectionModal } from './SectionEditModal'
import { useResizableColumns, ColResizeHandle, type ResizableColumn } from './useResizableColumns'

const PAYMENT_COLUMNS: ResizableColumn[] = [
  { key: 'delete',  label: '削除 / #',  widthRem: 4.5 },
  { key: 'date',    label: '入金日',    widthRem: 7 },
  { key: 'method',  label: '支払方法',  widthRem: 6 },
  { key: 'amount',  label: '金額',      widthRem: 7 },
  { key: 'memo',    label: 'メモ',      widthRem: 10, flex: true },
  { key: 'owner',   label: '担当者',    widthRem: 8 },
]

type PaymentInitial = {
  id:             string
  payment_method: string
  memo:           string | null
  amount:         string
  payment_date:   string
  owner_id:       string | null
  branch_id:      string | null
}

type RowStatus = 'unchanged' | 'edited' | 'new' | 'deleted'

type StagedRow = {
  _key:           string
  _dbId:          string | null
  _status:        RowStatus
  payment_date:   string
  payment_method: string
  amount:         string
  memo:           string
  owner_id:       string
  branch_id:      string
}

type Props = {
  initialPayments: PaymentInitial[]
  canEdit:         boolean
  users:           { id: string; name: string }[]
  invoiceTotal?:   number
  createAction:    (formData: FormData) => Promise<void>
  updateAction:    (paymentId: string, formData: FormData) => Promise<void>
  deleteAction:    (paymentId: string) => Promise<void>
}

const METHODS = ['現金', 'クレジット', '銀行振込', '小切手', 'その他']
const cell = 'w-full bg-transparent border border-transparent rounded px-2 py-1 text-sm focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-200/50 focus:outline-none disabled:opacity-50'
const cellNum = cell + ' text-right font-mono'

function toStaged(p: PaymentInitial): StagedRow {
  return {
    _key: p.id, _dbId: p.id, _status: 'unchanged',
    payment_date: p.payment_date,
    payment_method: p.payment_method,
    amount: p.amount,
    memo: p.memo ?? '',
    owner_id: p.owner_id ?? '',
    branch_id: p.branch_id ?? '',
  }
}
function newRow(): StagedRow {
  return {
    _key: 'new-' + Math.random().toString(36).slice(2, 10),
    _dbId: null, _status: 'new',
    payment_date: new Date().toISOString().slice(0, 10),
    payment_method: '現金',
    amount: '',
    memo: '',
    owner_id: '',
    branch_id: '',
  }
}
function toFormData(r: StagedRow): FormData {
  const fd = new FormData()
  fd.set('payment_date', r.payment_date)
  fd.set('payment_method', r.payment_method)
  fd.set('amount', r.amount)
  fd.set('memo', r.memo)
  fd.set('owner_id', r.owner_id)
  fd.set('branch_id', r.branch_id)
  return fd
}

export default function StagedPaymentsTable({
  initialPayments, canEdit, users, invoiceTotal,
  createAction, updateAction, deleteAction,
}: Props) {
  const modal = useSectionModal()
  const router = useRouter()
  const initial = useMemo(() => initialPayments.map(toStaged), [initialPayments])
  const [rows, setRows] = useState<StagedRow[]>(initial)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // 列幅リサイズ
  const { columns, widths, gridTemplate, setWidth, resetWidths } =
    useResizableColumns('staged-payments.cols.v1', PAYMENT_COLUMNS)

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

  let paidSum = 0
  for (const r of rows) {
    if (r._status === 'deleted') continue
    const a = Number(r.amount)
    if (Number.isFinite(a)) paidSum += a
  }
  const balance = invoiceTotal != null ? invoiceTotal - paidSum : null

  async function handleSave() {
    setError(null)
    const ops: Array<() => Promise<void>> = []
    for (const r of rows) {
      if (r._status === 'new') {
        if (!r.amount.trim() || !r.payment_date.trim()) continue
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
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs text-zinc-500">
            セルを直接編集 → <strong className="text-blue-600">「保存」</strong> で確定。
          </p>
          <button
            type="button"
            onClick={resetWidths}
            className="text-[11px] text-zinc-500 hover:text-blue-600 hover:underline"
            title="列幅を既定値に戻す"
          >
            ↻ 列幅リセット
          </button>
        </div>
      )}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>
      )}

      <div className="bg-white border border-zinc-200 rounded-lg overflow-x-auto">
        <div className="min-w-[800px]">
          <div
            className="grid gap-1 px-2 py-1.5 bg-zinc-50 border-b-2 border-zinc-200 text-[11px] font-semibold text-zinc-700 [&>div]:px-2"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {columns.map((col, i) => (
              <div key={col.key} className="relative">
                {col.label}
                {!col.flex && i < columns.length - 1 && (
                  <ColResizeHandle currentRem={widths[i]} onResize={(rem) => setWidth(i, rem)} />
                )}
              </div>
            ))}
          </div>

          {rows.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-zinc-400 border-b border-zinc-100">
              入金記録はまだありません。下の「＋ 行を追加」から作成してください。
            </div>
          ) : (
            rows.map((r, idx) => {
              const cls =
                r._status === 'deleted' ? 'opacity-50 bg-rose-50/50 line-through' :
                r._status === 'edited'  ? 'bg-zinc-50/40' :
                r._status === 'new'     ? 'bg-emerald-50/30 border-l-4 border-emerald-400' :
                                          'hover:bg-zinc-50/20'
              return (
                <div
                  key={r._key}
                  className={`grid items-center gap-1 px-2 py-1 border-b border-zinc-100 ${cls}`}
                  style={{ gridTemplateColumns: gridTemplate }}
                >
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
                  <input type="date" value={r.payment_date} onChange={(e) => update(r._key, 'payment_date', e.target.value)} required disabled={!canEdit || r._status === 'deleted'} className={cell} />
                  <select value={r.payment_method} onChange={(e) => update(r._key, 'payment_method', e.target.value)} required disabled={!canEdit || r._status === 'deleted'} className={`${cell} bg-white`}>
                    {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <input type="number" min="0" value={r.amount} onChange={(e) => update(r._key, 'amount', e.target.value)} required placeholder="金額" disabled={!canEdit || r._status === 'deleted'} className={cellNum} />
                  <input value={r.memo} onChange={(e) => update(r._key, 'memo', e.target.value)} placeholder="メモ" disabled={!canEdit || r._status === 'deleted'} className={cell} />
                  <select value={r.owner_id} onChange={(e) => update(r._key, 'owner_id', e.target.value)} disabled={!canEdit || r._status === 'deleted'} className={`${cell} bg-white`}>
                    <option value="">— 担当者 —</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
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
            <div
              className="grid gap-1 px-2 py-2 bg-zinc-50 border-t-2 border-zinc-300 text-sm [&>div]:px-2"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              <div></div>
              <div></div>
              <div className="text-right text-xs text-zinc-600">入金合計</div>
              <div className="text-right font-mono font-bold">¥{paidSum.toLocaleString()}</div>
              {invoiceTotal != null ? (
                <>
                  <div className="text-right text-xs text-zinc-600">請求合計 <span className="font-mono">¥{invoiceTotal.toLocaleString()}</span></div>
                  <div className={`text-right text-xs font-bold ${balance != null && balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    残額 <span className="font-mono">¥{(balance ?? 0).toLocaleString()}</span>
                  </div>
                </>
              ) : (
                <>
                  <div></div>
                  <div></div>
                </>
              )}
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
