'use client'

import { useActionState, useRef } from 'react'

type Props = { action: (formData: FormData) => Promise<void> }

const CATEGORIES = ['課税', '非課税']
const base = 'w-full border border-zinc-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function FeeAddForm({ action }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
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
      <h3 className="text-sm font-semibold text-zinc-700">＋ 諸費用を追加</h3>
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
        <div className="sm:col-span-2">
          <label className="block text-xs text-zinc-500 mb-0.5">区分</label>
          <select name="category" defaultValue="課税" className={`${base} bg-white`}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="sm:col-span-5">
          <label className="block text-xs text-zinc-500 mb-0.5">項目名 <span className="text-red-500">*</span></label>
          <input name="item_name" required placeholder="例: 自賠責保険 / 重量税" className={base} />
        </div>
        <div className="sm:col-span-3">
          <label className="block text-xs text-zinc-500 mb-0.5">金額</label>
          <input type="number" name="amount" min="0" className={base} />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-zinc-500 mb-0.5">原価</label>
          <input type="number" name="cost_amount" min="0" className={base} />
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
