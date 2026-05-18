'use client'

/**
 * 作業項目テーブルの「＋ 行を追加」行。
 *
 * テーブル末尾（合計の前）に常駐する空行。「項目名」を入力して
 * Enter または「+追加」ボタンで送信。送信後は input がクリアされる。
 */
import { useActionState, useRef } from 'react'

type Props = {
  action: (formData: FormData) => Promise<void>
}

const cellInput = 'w-full bg-white border border-zinc-200 rounded px-2 py-1 text-sm placeholder:text-zinc-300 focus:border-amber-400 focus:ring-2 focus:ring-amber-200/50 focus:outline-none'
const cellInputNum = cellInput + ' text-right font-mono'

export default function LineItemAddRow({ action }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [error, dispatch, pending] = useActionState(
    async (_prev: string | null, fd: FormData) => {
      try {
        await action(fd)
        formRef.current?.reset()
        // 1 つ目の input にフォーカスを戻して連続入力できるように
        const firstInput = formRef.current?.querySelector('input[name="work_category"]') as HTMLInputElement | null
        firstInput?.focus()
        return null
      } catch (e) {
        return (e as Error).message
      }
    },
    null,
  )

  return (
    <>
      {error && (
        <div className="mx-2 my-1 rounded-md bg-red-50 border border-red-200 px-3 py-1.5 text-xs text-red-700">{error}</div>
      )}
      <form
        ref={formRef}
        action={dispatch}
        className="grid grid-cols-[2rem_5rem_minmax(0,1fr)_4rem_6rem_4rem_4rem_6rem_6rem_5rem_6rem] items-center gap-1 px-2 py-1 border-t-2 border-dashed border-amber-200 bg-amber-50/30"
      >
        <div className="text-amber-700 font-bold text-center">＋</div>
        <input name="work_category" placeholder="区分" disabled={pending} className={cellInput} />
        <input name="item_name" required placeholder="作業項目名 *" disabled={pending} className={cellInput} />
        <input type="number" name="hours" step="0.1" placeholder="工数" disabled={pending} className={cellInputNum} />
        <input type="number" name="labor_amount" min="0" placeholder="工賃" disabled={pending} className={cellInputNum} />
        <input type="number" name="parts_qty" step="0.01" placeholder="数" disabled={pending} className={cellInputNum} />
        <input name="parts_unit" placeholder="単位" disabled={pending} className={cellInput} />
        <input type="number" name="parts_unit_price" min="0" placeholder="単価" disabled={pending} className={cellInputNum} />
        <div className="text-right text-sm text-zinc-400 px-2">—</div>
        <div className="text-center text-zinc-300">—</div>
        <div className="flex items-center justify-end gap-1">
          <input type="hidden" name="cost_unit_price" defaultValue="" />
          <button
            type="submit"
            disabled={pending}
            className="px-2 py-1 bg-amber-600 text-white text-xs font-medium rounded hover:bg-amber-700 disabled:opacity-50"
            title="この行を追加 (Enter)"
          >
            {pending ? '...' : '＋ 追加'}
          </button>
        </div>
      </form>
    </>
  )
}
