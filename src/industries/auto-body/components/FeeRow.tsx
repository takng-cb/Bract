'use client'

import { useState, useActionState } from 'react'

type Fee = {
  id:          string
  category:    string
  item_name:   string
  amount:      string | null
  cost_amount: string | null
}

type Props = {
  index:        number
  fee:          Fee
  canEdit:      boolean
  updateAction: (formData: FormData) => Promise<void>
  deleteAction: () => Promise<void>
}

const CATEGORIES = ['課税', '非課税']
const base = 'w-full border border-zinc-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function FeeRow({ index, fee, canEdit, updateAction, deleteAction }: Props) {
  const [editing, setEditing] = useState(false)

  if (editing) return <EditRow index={index} fee={fee} action={updateAction} onCancel={() => setEditing(false)} />

  const amount = Number(fee.amount ?? 0)

  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <span className="text-xs text-zinc-400 font-mono w-6">#{index + 1}</span>
      <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${fee.category === '非課税' ? 'bg-zinc-100 text-zinc-600' : 'bg-blue-50 text-blue-700'}`}>
        {fee.category}
      </span>
      <span className="text-sm font-medium text-zinc-900 flex-1 min-w-0 truncate">{fee.item_name}</span>
      <span className="font-mono text-sm text-zinc-800 shrink-0">¥{amount.toLocaleString()}</span>
      {canEdit && (
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50">編集</button>
          <form
            action={async () => { await deleteAction() }}
            onSubmit={(e) => { if (!confirm(`「${fee.item_name}」を削除しますか？`)) e.preventDefault() }}
          >
            <button type="submit" className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50">削除</button>
          </form>
        </div>
      )}
    </div>
  )
}

function EditRow({
  index, fee, action, onCancel,
}: {
  index: number
  fee: Fee
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
    <form action={dispatch} className="px-4 py-4 bg-blue-50/40 space-y-2">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>
      )}
      <div className="text-xs text-zinc-500">#{index + 1} 編集中</div>
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
        <div className="sm:col-span-2">
          <label className="block text-xs text-zinc-500 mb-0.5">区分</label>
          <select name="category" defaultValue={fee.category} className={`${base} bg-white`}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="sm:col-span-5">
          <label className="block text-xs text-zinc-500 mb-0.5">項目名 <span className="text-red-500">*</span></label>
          <input name="item_name" defaultValue={fee.item_name} required className={base} />
        </div>
        <div className="sm:col-span-3">
          <label className="block text-xs text-zinc-500 mb-0.5">金額</label>
          <input type="number" name="amount" min="0" defaultValue={fee.amount ?? ''} className={base} />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-zinc-500 mb-0.5">原価</label>
          <input type="number" name="cost_amount" min="0" defaultValue={fee.cost_amount ?? ''} className={base} />
        </div>
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
