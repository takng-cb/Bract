'use client'

/**
 * 諸費用テーブルの 1 行（既存行）。インライン編集。
 */
import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type Fee = {
  id:           string
  category:     string
  item_name:    string
  amount:       string | null
  cost_amount:  string | null
}

type Props = {
  index:        number
  fee:          Fee
  canEdit:      boolean
  updateAction: (formData: FormData) => Promise<void>
  deleteAction: () => Promise<void>
}

const cellInput = 'w-full bg-transparent border border-transparent rounded px-2 py-1 text-sm focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-200/50 focus:outline-none'
const cellInputNum = cellInput + ' text-right font-mono'

function serializeRow(f: Fee): string {
  return [f.category, f.item_name, f.amount ?? '', f.cost_amount ?? ''].join('\x1f')
}
function serializeFromForm(form: HTMLFormElement): string {
  const get = (n: string) => (form.querySelector(`[name="${n}"]`) as HTMLInputElement | null)?.value ?? ''
  return [get('category'), get('item_name'), get('amount'), get('cost_amount')].join('\x1f')
}

export default function FeeRow({ index, fee, canEdit, updateAction, deleteAction }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [snapshot, setSnapshot] = useState<string>(() => serializeRow(fee))
  const router = useRouter()

  function maybeSave() {
    if (!canEdit || !formRef.current) return
    const current = serializeFromForm(formRef.current)
    if (current === snapshot) return
    const fd = new FormData(formRef.current)
    setSaving(true)
    startTransition(async () => {
      try {
        await updateAction(fd)
        setSnapshot(current)
        router.refresh()
      } finally {
        setSaving(false)
      }
    })
  }

  return (
    <form
      ref={formRef}
      onBlur={maybeSave}
      onChange={(e) => { if (e.target instanceof HTMLSelectElement) maybeSave() }}
      onKeyDown={(e) => { if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); maybeSave() } }}
      className="grid grid-cols-[2rem_5rem_minmax(0,1fr)_6rem_6rem_5rem] items-center gap-1 px-2 py-1 border-b border-zinc-100 hover:bg-amber-50/20"
    >
      <div className="text-xs text-zinc-400 font-mono text-center">{index + 1}</div>
      <select name="category" defaultValue={fee.category} disabled={!canEdit} className={`${cellInput} bg-white`}>
        <option value="課税">課税</option>
        <option value="非課税">非課税</option>
      </select>
      <input name="item_name" defaultValue={fee.item_name} required placeholder="項目名" disabled={!canEdit} className={cellInput} />
      <input type="number" name="amount" min="0" defaultValue={fee.amount ?? ''} placeholder="金額" disabled={!canEdit} className={cellInputNum} />
      <input type="number" name="cost_amount" min="0" defaultValue={fee.cost_amount ?? ''} placeholder="原価" disabled={!canEdit} className={cellInputNum} />
      <div className="flex items-center justify-end gap-1 text-xs">
        {saving && <span className="text-amber-700 text-[10px]">保存中…</span>}
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              if (!confirm(`「${fee.item_name}」を削除しますか？`)) return
              startTransition(async () => { await deleteAction(); router.refresh() })
            }}
            className="text-rose-500 hover:text-rose-700 px-1 py-0.5 rounded hover:bg-rose-50"
          >
            🗑
          </button>
        )}
      </div>
    </form>
  )
}
