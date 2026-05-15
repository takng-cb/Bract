'use client'

import { useActionState, useRef } from 'react'

type Props = {
  action: (formData: FormData) => Promise<void>
  users:  { id: string; name: string }[]
}

const METHODS = ['現金', 'クレジット', '銀行振込', '小切手', 'その他']
const base = 'w-full border border-zinc-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function PaymentAddForm({ action, users }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const today = new Date().toISOString().slice(0, 10)
  const [error, dispatch, pending] = useActionState(
    async (_prev: string | null, fd: FormData) => {
      try { await action(fd); formRef.current?.reset(); return null }
      catch (e) { return (e as Error).message }
    },
    null,
  )

  return (
    <form ref={formRef} action={dispatch}
      className="bg-white border border-blue-200 border-dashed rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-semibold text-zinc-700">＋ 入金を追加</h3>
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
        <div className="sm:col-span-2">
          <label className="block text-xs text-zinc-500 mb-0.5">入金日 <span className="text-red-500">*</span></label>
          <input type="date" name="payment_date" defaultValue={today} required className={base} />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-zinc-500 mb-0.5">支払方法 <span className="text-red-500">*</span></label>
          <select name="payment_method" defaultValue="現金" required className={`${base} bg-white`}>
            {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-zinc-500 mb-0.5">金額 <span className="text-red-500">*</span></label>
          <input type="number" name="amount" min="0" required className={base} />
        </div>
        <div className="sm:col-span-3">
          <label className="block text-xs text-zinc-500 mb-0.5">担当者</label>
          <select name="owner_id" defaultValue="" className={`${base} bg-white`}>
            <option value="">—</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div className="sm:col-span-3">
          <label className="block text-xs text-zinc-500 mb-0.5">拠点</label>
          <input name="branch_id" placeholder="例: 本店" className={base} />
        </div>
        <div className="sm:col-span-12">
          <label className="block text-xs text-zinc-500 mb-0.5">メモ</label>
          <input name="memo" placeholder="任意" className={base} />
        </div>
      </div>
      <div className="flex justify-end">
        <button type="submit" disabled={pending}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50">
          {pending ? '追加中…' : '＋ 追加'}
        </button>
      </div>
    </form>
  )
}
