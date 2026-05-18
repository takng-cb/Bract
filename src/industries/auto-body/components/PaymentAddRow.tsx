'use client'

import { useActionState, useRef } from 'react'

type Props = {
  action: (formData: FormData) => Promise<void>
  users: { id: string; name: string }[]
}

const METHODS = ['現金', 'クレジット', '銀行振込', '小切手', 'その他']
const cellInput = 'w-full bg-white border border-zinc-200 rounded px-2 py-1 text-sm placeholder:text-zinc-300 focus:border-amber-400 focus:ring-2 focus:ring-amber-200/50 focus:outline-none'
const cellInputNum = cellInput + ' text-right font-mono'

export default function PaymentAddRow({ action, users }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [error, dispatch, pending] = useActionState(
    async (_prev: string | null, fd: FormData) => {
      try {
        await action(fd)
        formRef.current?.reset()
        const dateInput = formRef.current?.querySelector('input[name="payment_date"]') as HTMLInputElement | null
        if (dateInput) {
          dateInput.value = new Date().toISOString().slice(0, 10)
          dateInput.focus()
        }
        return null
      } catch (e) {
        return (e as Error).message
      }
    },
    null,
  )

  const today = new Date().toISOString().slice(0, 10)

  return (
    <>
      {error && (
        <div className="mx-2 my-1 rounded-md bg-red-50 border border-red-200 px-3 py-1.5 text-xs text-red-700">{error}</div>
      )}
      <form
        ref={formRef}
        action={dispatch}
        className="grid grid-cols-[2rem_7rem_6rem_7rem_minmax(0,1fr)_8rem_5rem] items-center gap-1 px-2 py-1 border-t-2 border-dashed border-amber-200 bg-amber-50/30"
      >
        <div className="text-amber-700 font-bold text-center">＋</div>
        <input type="date" name="payment_date" required defaultValue={today} disabled={pending} className={cellInput} />
        <select name="payment_method" required defaultValue="現金" disabled={pending} className={`${cellInput} bg-white`}>
          {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <input type="number" name="amount" min="0" required placeholder="金額 *" disabled={pending} className={cellInputNum} />
        <input name="memo" placeholder="メモ" disabled={pending} className={cellInput} />
        <select name="owner_id" disabled={pending} className={`${cellInput} bg-white`}>
          <option value="">— 担当者 —</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <button type="submit" disabled={pending} className="px-2 py-1 bg-amber-600 text-white text-xs font-medium rounded hover:bg-amber-700 disabled:opacity-50">
          {pending ? '...' : '＋ 追加'}
        </button>
        <input type="hidden" name="branch_id" defaultValue="" />
      </form>
    </>
  )
}
