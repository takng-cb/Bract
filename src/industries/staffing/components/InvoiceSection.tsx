/**
 * 案件詳細の「売上・請求」セクション（staffing Phase5 / REQ-0007 / #14）。
 *
 * サーバーコンポーネント。請求データの生成（確定内容から）・ステータス更新・
 * 未請求時の削除を <form action> で行う（クライアント JS 不要）。
 */
import { db } from '@/lib/db'
import { invoices } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { JapaneseYen } from 'lucide-react'
import { generateInvoice, updateInvoiceStatus, deleteInvoice } from '@/industries/staffing/actions/invoices'

const BILLING_STATUSES = ['未請求', '請求済', '入金済']
const PAYMENT_STATUSES = ['未払', '支払済']

function yen(v: string | null): string {
  return v != null ? `¥${Number(v).toLocaleString()}` : '—'
}

export default async function InvoiceSection({ assignmentId, canEdit }: { assignmentId: string; canEdit: boolean }) {
  const inv = await db.select().from(invoices)
    .where(eq(invoices.assignment_id, assignmentId))
    .then((r) => r[0] ?? null)

  return (
    <section className="bg-white border border-zinc-200 rounded-lg shadow-xs">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-100">
        <JapaneseYen className="w-4 h-4 text-zinc-500" strokeWidth={2.25} aria-hidden />
        <h2 className="text-sm font-bold text-zinc-700">売上・請求</h2>
      </div>
      <div className="p-4">
        {!inv ? (
          <div className="text-center py-4">
            <p className="text-sm text-zinc-400 mb-3">請求データはまだありません</p>
            {canEdit && (
              <form action={generateInvoice.bind(null, assignmentId)}>
                <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  確定内容から請求データを作成
                </button>
              </form>
            )}
            <p className="mt-2 text-[11px] text-zinc-400">請求額＝発注単価、支払額＝確定候補の提示単価合計、粗利＝差額</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 金額サマリー */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-md bg-zinc-50 border border-zinc-100 px-2 py-3">
                <p className="text-[10px] text-zinc-500 mb-1">請求額（売上）</p>
                <p className="text-base font-bold font-mono text-zinc-900">{yen(inv.billing_amount)}</p>
              </div>
              <div className="rounded-md bg-zinc-50 border border-zinc-100 px-2 py-3">
                <p className="text-[10px] text-zinc-500 mb-1">支払額（原価）</p>
                <p className="text-base font-bold font-mono text-zinc-700">{yen(inv.payment_amount)}</p>
              </div>
              <div className="rounded-md bg-emerald-50 border border-emerald-100 px-2 py-3">
                <p className="text-[10px] text-emerald-700 mb-1">粗利</p>
                <p className="text-base font-bold font-mono text-emerald-700">{yen(inv.margin)}</p>
              </div>
            </div>

            {/* ステータス更新 */}
            {canEdit ? (
              <form action={updateInvoiceStatus.bind(null, inv.id)} className="flex flex-wrap items-end gap-3">
                <label className="block">
                  <span className="mb-1 block text-[10px] text-zinc-500">請求ステータス</span>
                  <select name="billing_status" defaultValue={inv.billing_status} className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
                    {BILLING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] text-zinc-500">支払ステータス</span>
                  <select name="payment_status" defaultValue={inv.payment_status} className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
                    {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <button type="submit" className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
                  更新
                </button>
              </form>
            ) : (
              <p className="text-xs text-zinc-500">請求: {inv.billing_status} ・ 支払: {inv.payment_status}</p>
            )}

            <dl className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-zinc-400">
              {inv.billed_at && <div>請求日: {new Date(inv.billed_at).toLocaleDateString('ja-JP')}</div>}
              {inv.paid_at && <div>支払日: {new Date(inv.paid_at).toLocaleDateString('ja-JP')}</div>}
            </dl>

            {canEdit && inv.billing_status === '未請求' && (
              <div className="flex items-center gap-3 border-t border-zinc-100 pt-3">
                <form action={generateInvoice.bind(null, assignmentId)}>
                  <button type="submit" className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50">
                    金額を再計算（確定内容から）
                  </button>
                </form>
                <form action={deleteInvoice.bind(null, inv.id)}>
                  <button type="submit" className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50">
                    請求データを削除
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
