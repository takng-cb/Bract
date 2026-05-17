'use client'

import { useActionState, useRef } from 'react'

type Props = {
  action: (formData: FormData) => Promise<void>
}

const base = 'w-full border border-zinc-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500'

export default function TemplateFeeAddForm({ action }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [error, dispatch, pending] = useActionState(
    async (_prev: string | null, fd: FormData) => {
      try { await action(fd); formRef.current?.reset(); return null }
      catch (e) { return (e as Error).message }
    },
    null,
  )
  return (
    <form ref={formRef} action={dispatch} className="px-4 py-3 mt-3 bg-amber-50/30 border border-amber-200 rounded-md space-y-2">
      {error && <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>}
      <p className="text-xs text-amber-800 font-medium">＋ 諸費用を追加</p>
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
        <div className="sm:col-span-2">
          <select name="category" required className={`${base} bg-white`}>
            <option value="課税">課税</option>
            <option value="非課税">非課税</option>
          </select>
        </div>
        <div className="sm:col-span-5">
          <input name="item_name" required placeholder="項目名 *" className={base} />
        </div>
        <div className="sm:col-span-2">
          <input type="number" name="amount" min="0" placeholder="金額" className={base} />
        </div>
        <div className="sm:col-span-2">
          <input type="number" name="cost_amount" min="0" placeholder="原価" className={base} />
        </div>
        <div className="sm:col-span-1">
          <button type="submit" disabled={pending} className="w-full px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded hover:bg-amber-700 disabled:opacity-50">
            {pending ? '…' : '＋'}
          </button>
        </div>
      </div>
    </form>
  )
}
