'use client'

import { useState, useActionState } from 'react'

type Payment = {
  id:             string
  payment_method: string
  memo:           string | null
  amount:         string
  payment_date:   string
  owner_id:       string | null
  branch_id:      string | null
}

type Props = {
  index:        number
  payment:      Payment
  users:        { id: string; name: string }[]
  canEdit:      boolean
  updateAction: (formData: FormData) => Promise<void>
  deleteAction: () => Promise<void>
}

const METHODS = ['現金', 'クレジット', '銀行振込', '小切手', 'その他']
const base = 'w-full border border-zinc-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function PaymentRow({ index, payment, users, canEdit, updateAction, deleteAction }: Props) {
  const [editing, setEditing] = useState(false)
  if (editing) {
    return <EditRow index={index} payment={payment} users={users} action={updateAction} onCancel={() => setEditing(false)} />
  }

  const owner = users.find((u) => u.id === payment.owner_id)
  const amount = Number(payment.amount)

  return (
    <div className="px-4 py-3 flex items-center gap-3 flex-wrap sm:flex-nowrap">
      <span className="text-xs text-zinc-400 font-mono w-6 shrink-0">#{index + 1}</span>
      <span className="text-sm text-zinc-700 shrink-0">{payment.payment_date}</span>
      <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 shrink-0">{payment.payment_method}</span>
      <span className="font-mono text-sm font-semibold text-zinc-900 shrink-0">¥{amount.toLocaleString()}</span>
      <span className="text-xs text-zinc-500 flex-1 min-w-0 truncate">{payment.memo ?? ''}</span>
      {owner && <span className="text-xs text-zinc-500 shrink-0">👤 {owner.name}</span>}
      {canEdit && (
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50">編集</button>
          <form
            action={async () => { await deleteAction() }}
            onSubmit={(e) => { if (!confirm(`${payment.payment_date} の入金（¥${amount.toLocaleString()}）を削除しますか？`)) e.preventDefault() }}
          >
            <button type="submit" className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50">削除</button>
          </form>
        </div>
      )}
    </div>
  )
}

function EditRow({
  index, payment, users, action, onCancel,
}: {
  index: number
  payment: Payment
  users: { id: string; name: string }[]
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
          <label className="block text-xs text-zinc-500 mb-0.5">入金日 <span className="text-red-500">*</span></label>
          <input type="date" name="payment_date" defaultValue={payment.payment_date} required className={base} />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-zinc-500 mb-0.5">支払方法 <span className="text-red-500">*</span></label>
          <select name="payment_method" defaultValue={payment.payment_method} required className={`${base} bg-white`}>
            {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-zinc-500 mb-0.5">金額 <span className="text-red-500">*</span></label>
          <input type="number" name="amount" min="0" defaultValue={payment.amount} required className={base} />
        </div>
        <div className="sm:col-span-3">
          <label className="block text-xs text-zinc-500 mb-0.5">担当者</label>
          <select name="owner_id" defaultValue={payment.owner_id ?? ''} className={`${base} bg-white`}>
            <option value="">—</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div className="sm:col-span-3">
          <label className="block text-xs text-zinc-500 mb-0.5">拠点</label>
          <input name="branch_id" defaultValue={payment.branch_id ?? ''} className={base} />
        </div>
        <div className="sm:col-span-12">
          <label className="block text-xs text-zinc-500 mb-0.5">メモ</label>
          <input name="memo" defaultValue={payment.memo ?? ''} className={base} />
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
