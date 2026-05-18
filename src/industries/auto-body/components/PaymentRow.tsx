'use client'

/**
 * 入金テーブルの 1 行（既存行）。インライン編集。
 */
import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

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
const cellInput = 'w-full bg-transparent border border-transparent rounded px-2 py-1 text-sm focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-200/50 focus:outline-none'
const cellInputNum = cellInput + ' text-right font-mono'

function serializeRow(p: Payment): string {
  return [p.payment_date, p.payment_method, p.amount, p.memo ?? '', p.owner_id ?? '', p.branch_id ?? ''].join('\x1f')
}
function serializeFromForm(form: HTMLFormElement): string {
  const get = (n: string) => (form.querySelector(`[name="${n}"]`) as HTMLInputElement | null)?.value ?? ''
  return [get('payment_date'), get('payment_method'), get('amount'), get('memo'), get('owner_id'), get('branch_id')].join('\x1f')
}

export default function PaymentRow({ index, payment, users, canEdit, updateAction, deleteAction }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [snapshot, setSnapshot] = useState<string>(() => serializeRow(payment))
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
      className="grid grid-cols-[2rem_7rem_6rem_7rem_minmax(0,1fr)_8rem_5rem] items-center gap-1 px-2 py-1 border-b border-zinc-100 hover:bg-amber-50/20"
    >
      <div className="text-xs text-zinc-400 font-mono text-center">{index + 1}</div>
      <input type="date" name="payment_date" defaultValue={payment.payment_date} required disabled={!canEdit} className={cellInput} />
      <select name="payment_method" defaultValue={payment.payment_method} required disabled={!canEdit} className={`${cellInput} bg-white`}>
        {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <input type="number" name="amount" min="0" defaultValue={payment.amount} required placeholder="金額" disabled={!canEdit} className={cellInputNum} />
      <input name="memo" defaultValue={payment.memo ?? ''} placeholder="メモ" disabled={!canEdit} className={cellInput} />
      <select name="owner_id" defaultValue={payment.owner_id ?? ''} disabled={!canEdit} className={`${cellInput} bg-white`}>
        <option value="">— 担当者 —</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      <div className="flex items-center justify-end gap-1 text-xs">
        {saving && <span className="text-amber-700 text-[10px]">保存中…</span>}
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              if (!confirm(`${payment.payment_date} の入金（¥${Number(payment.amount).toLocaleString()}）を削除しますか？`)) return
              startTransition(async () => { await deleteAction(); router.refresh() })
            }}
            className="text-rose-500 hover:text-rose-700 px-1 py-0.5 rounded hover:bg-rose-50"
          >
            🗑
          </button>
        )}
      </div>
      <input type="hidden" name="branch_id" defaultValue={payment.branch_id ?? ''} />
    </form>
  )
}
