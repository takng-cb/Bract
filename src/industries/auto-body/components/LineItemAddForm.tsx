'use client'

import { useActionState, useRef } from 'react'

type Props = {
  action:    (formData: FormData) => Promise<void>
  leverRate: string | null
}

const base = 'w-full border border-zinc-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function LineItemAddForm({ action, leverRate }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [error, dispatch, pending] = useActionState(
    async (_prev: string | null, fd: FormData) => {
      try {
        await action(fd)
        formRef.current?.reset()
        return null
      } catch (e) {
        return (e as Error).message
      }
    },
    null,
  )

  return (
    <form ref={formRef} action={dispatch}
      className="bg-white border border-blue-200 border-dashed rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-700">＋ 作業項目を追加</h3>
        {leverRate && (
          <span className="text-xs text-zinc-400">レバーレート: ¥{Number(leverRate).toLocaleString()}/h</span>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
        <div className="sm:col-span-3">
          <label className="block text-xs text-zinc-500 mb-0.5">作業区分</label>
          <input name="work_category" placeholder="例: 板金 / 塗装" className={base} />
        </div>
        <div className="sm:col-span-9">
          <label className="block text-xs text-zinc-500 mb-0.5">作業項目名 <span className="text-red-500">*</span></label>
          <input name="item_name" required placeholder="例: フロントバンパー交換" className={base} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
        <div>
          <label className="block text-xs text-zinc-500 mb-0.5">工数</label>
          <input type="number" name="hours" step="0.1" className={base} />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-0.5">工賃（税別）</label>
          <input type="number" name="labor_amount" min="0" className={base} />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-0.5">部品数</label>
          <input type="number" name="parts_qty" step="0.01" className={base} />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-0.5">単位</label>
          <input name="parts_unit" placeholder="個" className={base} />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-0.5">部品単価</label>
          <input type="number" name="parts_unit_price" min="0" className={base} />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-0.5">原単価</label>
          <input type="number" name="cost_unit_price" min="0" className={base} />
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
