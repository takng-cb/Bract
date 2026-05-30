'use client'

/**
 * 整備の請求・支払セクション編集フォーム (Issue #48 Phase 2)
 *
 * - billing_target (請求先種別)
 * - invoice_no (請求書番号)
 * - invoice_issued_at (請求書発行日)
 * - payment_due_date (支払期限)
 * - payment_status (支払状況)
 * - payment_terms (支払条件)
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateMaintenanceBilling } from '@/industries/auto-body/actions/maintenance'
import { useSectionModal } from './SectionEditModal'

const BILLING_TARGETS = ['顧客', '保険会社', 'リース会社', '代理店', 'その他']
const PAYMENT_STATUSES = ['未請求', '請求済', '一部入金', '入金済', '貸倒']

const FIELD_CLS = 'w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

export type MaintenanceBillingInitial = {
  billing_target:    string | null
  invoice_no:        string | null
  invoice_issued_at: string | null
  payment_due_date:  string | null
  payment_status:    string | null
  payment_terms:     string | null
}

function toStr(v: string | null | undefined): string {
  return v == null ? '' : String(v)
}

function Cell({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-[10px] text-zinc-500 mb-0.5">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-zinc-400 mt-0.5">{hint}</p>}
    </div>
  )
}

type Props = {
  maintenanceId: string
  initial:       MaintenanceBillingInitial
}

export default function MaintenanceBillingEditForm({ maintenanceId, initial }: Props) {
  const router = useRouter()
  const modal = useSectionModal()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [billingTarget,   setBillingTarget]   = useState(toStr(initial.billing_target))
  const [invoiceNo,       setInvoiceNo]       = useState(toStr(initial.invoice_no))
  const [invoiceIssuedAt, setInvoiceIssuedAt] = useState(toStr(initial.invoice_issued_at))
  const [paymentDueDate,  setPaymentDueDate]  = useState(toStr(initial.payment_due_date))
  const [paymentStatus,   setPaymentStatus]   = useState(toStr(initial.payment_status))
  const [paymentTerms,    setPaymentTerms]    = useState(toStr(initial.payment_terms))

  const initialState = {
    billing_target:    toStr(initial.billing_target),
    invoice_no:        toStr(initial.invoice_no),
    invoice_issued_at: toStr(initial.invoice_issued_at),
    payment_due_date:  toStr(initial.payment_due_date),
    payment_status:    toStr(initial.payment_status),
    payment_terms:     toStr(initial.payment_terms),
  }
  const currentState = {
    billing_target:    billingTarget,
    invoice_no:        invoiceNo,
    invoice_issued_at: invoiceIssuedAt,
    payment_due_date:  paymentDueDate,
    payment_status:    paymentStatus,
    payment_terms:     paymentTerms,
  }
  const dirty = (Object.keys(initialState) as (keyof typeof initialState)[])
    .some((k) => initialState[k] !== currentState[k])

  function handleSave() {
    setError(null)
    startTransition(async () => {
      try {
        await updateMaintenanceBilling(maintenanceId, {
          billing_target:    billingTarget    || null,
          invoice_no:        invoiceNo        || null,
          invoice_issued_at: invoiceIssuedAt  || null,
          payment_due_date:  paymentDueDate   || null,
          payment_status:    paymentStatus    || null,
          payment_terms:     paymentTerms     || null,
        })
        router.refresh()
        modal?.close()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })
  }

  function handleCancel() {
    if (dirty && !confirm('変更が破棄されます。よろしいですか？')) return
    modal?.close()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-md">{error}</div>
        )}

        <section className="bg-white border border-zinc-200 rounded-lg p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Cell label="請求先種別" hint="顧客 / 保険会社 / リース会社 等">
              <select value={billingTarget} onChange={(e) => setBillingTarget(e.target.value)} className={`${FIELD_CLS} bg-white`}>
                <option value="">—</option>
                {BILLING_TARGETS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Cell>

            <Cell label="支払状況">
              <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className={`${FIELD_CLS} bg-white`}>
                <option value="">—（自動判定）</option>
                {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Cell>

            <Cell label="請求書番号" hint="自由入力（例: INV-2026-001）">
              <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className={FIELD_CLS} />
            </Cell>

            <Cell label="支払条件" hint="例: 月末締め翌月末払い">
              <input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className={FIELD_CLS} />
            </Cell>

            <Cell label="請求書発行日">
              <input type="date" value={invoiceIssuedAt} onChange={(e) => setInvoiceIssuedAt(e.target.value)} className={FIELD_CLS} />
            </Cell>

            <Cell label="支払期限">
              <input type="date" value={paymentDueDate} onChange={(e) => setPaymentDueDate(e.target.value)} className={FIELD_CLS} />
            </Cell>
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 bg-white border-t border-zinc-200 mt-4 -mx-5 px-5 py-3 flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          {dirty
            ? <><span className="text-blue-600 font-semibold">●</span> 未保存の変更があります</>
            : '変更なし'}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={handleCancel}
            className="px-4 py-2 text-sm border border-zinc-300 rounded-md hover:bg-zinc-50">
            キャンセル
          </button>
          <button type="button" onClick={handleSave} disabled={pending || !dirty}
            className="px-4 py-2 text-sm bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 shadow-sm">
            {pending ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
