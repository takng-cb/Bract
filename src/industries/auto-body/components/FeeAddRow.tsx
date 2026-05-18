'use client'

/**
 * 諸費用テーブル末尾の「+ 行を追加」行。
 */
import { useActionState, useRef } from 'react'

type Props = { action: (formData: FormData) => Promise<void> }

const cellInput = 'w-full bg-white border border-zinc-200 rounded px-2 py-1 text-sm placeholder:text-zinc-300 focus:border-amber-400 focus:ring-2 focus:ring-amber-200/50 focus:outline-none'
const cellInputNum = cellInput + ' text-right font-mono'

export default function FeeAddRow({ action }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [error, dispatch, pending] = useActionState(
    async (_prev: string | null, fd: FormData) => {
      try {
        await action(fd)
        formRef.current?.reset()
        const cat = formRef.current?.querySelector('select[name="category"]') as HTMLSelectElement | null
        cat?.focus()
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
        className="grid grid-cols-[2rem_5rem_minmax(0,1fr)_6rem_6rem_5rem] items-center gap-1 px-2 py-1 border-t-2 border-dashed border-amber-200 bg-amber-50/30"
      >
        <div className="text-amber-700 font-bold text-center">＋</div>
        <select name="category" required defaultValue="課税" disabled={pending} className={`${cellInput} bg-white`}>
          <option value="課税">課税</option>
          <option value="非課税">非課税</option>
        </select>
        <input name="item_name" required placeholder="項目名 *" disabled={pending} className={cellInput} />
        <input type="number" name="amount" min="0" placeholder="金額" disabled={pending} className={cellInputNum} />
        <input type="number" name="cost_amount" min="0" placeholder="原価" disabled={pending} className={cellInputNum} />
        <button
          type="submit"
          disabled={pending}
          className="px-2 py-1 bg-amber-600 text-white text-xs font-medium rounded hover:bg-amber-700 disabled:opacity-50"
        >
          {pending ? '...' : '＋ 追加'}
        </button>
      </form>
    </>
  )
}
