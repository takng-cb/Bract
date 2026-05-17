'use client'

import { useActionState, useRef } from 'react'

type Props = {
  action: (formData: FormData) => Promise<void>
}

const base = 'w-full border border-zinc-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500'

export default function TemplateLineAddForm({ action }: Props) {
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
      <p className="text-xs text-amber-800 font-medium">＋ 作業項目を追加</p>
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
        <div className="sm:col-span-3">
          <input name="work_category" placeholder="区分（車検/板金/消耗品）" className={base} />
        </div>
        <div className="sm:col-span-9">
          <input name="item_name" required placeholder="項目名 *" className={base} />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
        <input type="number" name="hours" step="0.1" placeholder="工数" className={base} />
        <input type="number" name="labor_amount" min="0" placeholder="工賃" className={base} />
        <input type="number" name="parts_qty" step="0.01" placeholder="部品数" className={base} />
        <input name="parts_unit" placeholder="単位" className={base} />
        <input type="number" name="parts_unit_price" min="0" placeholder="部品単価" className={base} />
        <input type="number" name="cost_unit_price" min="0" placeholder="原単価" className={base} />
      </div>
      <div className="flex justify-end pt-1">
        <button type="submit" disabled={pending} className="px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded hover:bg-amber-700 disabled:opacity-50">
          {pending ? '追加中…' : '＋ 追加'}
        </button>
      </div>
    </form>
  )
}
