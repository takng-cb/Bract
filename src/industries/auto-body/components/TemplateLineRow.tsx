'use client'

import { useState, useActionState } from 'react'

type Line = {
  id:               string
  work_category:    string | null
  item_name:        string | null
  hours:            string | null
  labor_amount:     string | null
  parts_qty:        string | null
  parts_unit:       string | null
  parts_unit_price: string | null
  cost_unit_price:  string | null
  note:             string | null
}

type Props = {
  index:        number
  line:         Line
  canEdit:      boolean
  updateAction: (formData: FormData) => Promise<void>
  deleteAction: () => Promise<void>
}

const base = 'w-full border border-zinc-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

function yen(n: number | string | null | undefined): string {
  const v = Number(n ?? 0)
  if (!Number.isFinite(v)) return '—'
  return `¥${Math.round(v).toLocaleString()}`
}

export default function TemplateLineRow({ index, line, canEdit, updateAction, deleteAction }: Props) {
  const [editing, setEditing] = useState(false)
  if (editing) return <EditRow index={index} line={line} action={updateAction} onCancel={() => setEditing(false)} />

  const labor = Number(line.labor_amount ?? 0)
  const qty   = Number(line.parts_qty ?? 0)
  const unit  = Number(line.parts_unit_price ?? 0)
  const sub = (Number.isFinite(labor) ? labor : 0) + (Number.isFinite(qty) && Number.isFinite(unit) ? qty * unit : 0)

  return (
    <div className="px-4 py-2 hover:bg-zinc-50/30 flex items-start gap-3">
      <span className="text-xs text-zinc-400 font-mono w-6 shrink-0 mt-0.5">#{index + 1}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {line.work_category && <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600">{line.work_category}</span>}
          <span className="text-sm font-medium text-zinc-900">{line.item_name}</span>
        </div>
        <div className="mt-0.5 grid grid-cols-2 sm:grid-cols-5 gap-x-3 text-xs text-zinc-600">
          <span>工数: <span className="font-mono">{line.hours ?? '—'}</span></span>
          <span>工賃: <span className="font-mono">{yen(labor)}</span></span>
          <span>部品: <span className="font-mono">{line.parts_qty ?? '—'} {line.parts_unit ?? ''}</span></span>
          <span>単価: <span className="font-mono">{yen(unit)}</span></span>
          <span>小計: <span className="font-mono font-semibold text-zinc-800">{yen(sub)}</span></span>
        </div>
        {line.note && <p className="text-xs text-zinc-500 mt-0.5">📝 {line.note}</p>}
      </div>
      {canEdit && (
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-zinc-50">編集</button>
          <form
            action={async () => { await deleteAction() }}
            onSubmit={(e) => { if (!confirm(`「${line.item_name}」を削除しますか？`)) e.preventDefault() }}
          >
            <button type="submit" className="text-xs text-rose-500 hover:text-rose-700 px-2 py-1 rounded hover:bg-rose-50">削除</button>
          </form>
        </div>
      )}
    </div>
  )
}

function EditRow({ index, line, action, onCancel }: {
  index: number
  line: Line
  action: (formData: FormData) => Promise<void>
  onCancel: () => void
}) {
  const [error, dispatch, pending] = useActionState(
    async (_prev: string | null, fd: FormData) => {
      try { await action(fd); onCancel(); return null }
      catch (e) { return (e as Error).message }
    },
    null,
  )

  return (
    <form action={dispatch} className="px-4 py-3 bg-zinc-50/40 space-y-2">
      {error && <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>}
      <div className="text-xs text-zinc-500">#{index + 1} 編集中</div>
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
        <div className="sm:col-span-3">
          <label className="block text-xs text-zinc-500 mb-0.5">作業区分</label>
          <input name="work_category" defaultValue={line.work_category ?? ''} placeholder="車検 / 板金 / 消耗品" className={base} />
        </div>
        <div className="sm:col-span-9">
          <label className="block text-xs text-zinc-500 mb-0.5">項目名 <span className="text-red-500">*</span></label>
          <input name="item_name" defaultValue={line.item_name ?? ''} required className={base} />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
        <div><label className="block text-xs text-zinc-500 mb-0.5">工数</label><input type="number" name="hours" step="0.1" defaultValue={line.hours ?? ''} className={base} /></div>
        <div><label className="block text-xs text-zinc-500 mb-0.5">工賃</label><input type="number" name="labor_amount" min="0" defaultValue={line.labor_amount ?? ''} className={base} /></div>
        <div><label className="block text-xs text-zinc-500 mb-0.5">部品数</label><input type="number" name="parts_qty" step="0.01" defaultValue={line.parts_qty ?? ''} className={base} /></div>
        <div><label className="block text-xs text-zinc-500 mb-0.5">単位</label><input name="parts_unit" defaultValue={line.parts_unit ?? ''} placeholder="個/L" className={base} /></div>
        <div><label className="block text-xs text-zinc-500 mb-0.5">部品単価</label><input type="number" name="parts_unit_price" min="0" defaultValue={line.parts_unit_price ?? ''} className={base} /></div>
        <div><label className="block text-xs text-zinc-500 mb-0.5">原単価</label><input type="number" name="cost_unit_price" min="0" defaultValue={line.cost_unit_price ?? ''} className={base} /></div>
      </div>
      <div>
        <label className="block text-xs text-zinc-500 mb-0.5">備考</label>
        <input name="note" defaultValue={line.note ?? ''} className={base} />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="submit" disabled={pending} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50">
          {pending ? '保存中…' : '保存'}
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 border border-zinc-300 text-zinc-600 text-xs font-medium rounded hover:bg-zinc-50">キャンセル</button>
      </div>
    </form>
  )
}
