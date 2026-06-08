'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { createOutreach, updateOutreachStatus, deleteOutreach } from '@/industries/staffing/actions/outreach'
import { OUTREACH_STATUSES, outreachStatusColor } from '@/industries/staffing/lib/staffingService'

export type OutreachItem = {
  id: string
  agency_account_id: string | null
  agency_name: string | null
  status: string
  sent_at: string | null
  notes: string | null
}

const FIELD = 'border border-zinc-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

/** 打診状況（RFQ）：紹介会社へ打診を記録・状態管理 */
export default function OutreachSection({
  assignmentId,
  agencies,
  items,
}: {
  assignmentId: string
  agencies: { id: string; name: string }[]
  items: OutreachItem[]
}) {
  const [pending, start] = useTransition()
  const [agencyId, setAgencyId] = useState('')
  const [notes, setNotes] = useState('')

  const add = () => {
    if (!agencyId) return
    start(async () => {
      await createOutreach(assignmentId, agencyId, notes || null)
      setAgencyId(''); setNotes('')
    })
  }

  return (
    <section className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 mb-6">
      <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">打診状況（{items.length}社）</h2>

      {items.length === 0 ? (
        <p className="text-sm text-zinc-400 mb-4">まだ打診していません。紹介会社を選んで打診を記録できます。</p>
      ) : (
        <table className="w-full text-sm mb-4">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="text-left px-2 py-1.5 font-medium text-zinc-600">紹介会社</th>
              <th className="text-left px-2 py-1.5 font-medium text-zinc-600">状態</th>
              <th className="text-left px-2 py-1.5 font-medium text-zinc-600">メモ</th>
              <th className="px-2 py-1.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {items.map((o) => (
              <tr key={o.id}>
                <td className="px-2 py-1.5">
                  {o.agency_account_id
                    ? <Link href={`/accounts/${o.agency_account_id}`} className="text-blue-600 hover:underline">{o.agency_name ?? '—'}</Link>
                    : (o.agency_name ?? '—')}
                </td>
                <td className="px-2 py-1.5">
                  <select
                    value={o.status}
                    disabled={pending}
                    onChange={(e) => { const v = e.target.value; start(async () => { await updateOutreachStatus(o.id, assignmentId, v) }) }}
                    className={`rounded px-1.5 py-0.5 text-xs ${outreachStatusColor(o.status)} cursor-pointer`}
                  >
                    {OUTREACH_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5 text-zinc-500 text-xs">{o.notes ?? '—'}</td>
                <td className="px-2 py-1.5 text-right">
                  <button
                    disabled={pending}
                    onClick={() => start(async () => { await deleteOutreach(o.id, assignmentId) })}
                    className="text-xs text-rose-600 hover:underline disabled:opacity-50"
                  >削除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 打診を追加 */}
      <div className="border-t border-zinc-200 pt-4">
        <p className="text-xs text-zinc-500 mb-2">紹介会社へ打診を記録</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px]">
            <label className="block text-[10px] text-zinc-400 mb-0.5">紹介会社</label>
            <select value={agencyId} onChange={(e) => setAgencyId(e.target.value)} className={`${FIELD} bg-white w-full`}>
              <option value="">— 選択 —</option>
              {agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[10px] text-zinc-400 mb-0.5">メモ（任意）</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={`${FIELD} w-full`} placeholder="例: LINEで送付済み" />
          </div>
          <button
            onClick={add}
            disabled={pending || !agencyId}
            className="px-3 py-1.5 text-xs bg-zinc-800 text-white rounded-md hover:bg-zinc-900 disabled:opacity-50"
          >{pending ? '記録中…' : '打診を記録'}</button>
        </div>
        {agencies.length === 0 && (
          <p className="text-xs text-amber-600 mt-2">紹介会社（取引先の役割=人材会社）が未登録です。取引先で登録してください。</p>
        )}
      </div>
    </section>
  )
}
