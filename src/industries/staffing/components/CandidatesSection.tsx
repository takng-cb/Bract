'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  addCandidate, confirmCandidate, declineCandidate, reopenCandidate, removeCandidate,
} from '@/industries/staffing/actions/candidates'
import { candidateStatusColor, calcMarginFixed } from '@/industries/staffing/lib/staffingService'

export type CandidateItem = {
  id: string
  staff_id: string | null
  staff_name: string | null
  talent_name: string | null
  agency_account_id: string | null
  agency_name: string | null
  proposed_rate: string | number | null
  candidate_status: string | null
  notes: string | null
}

const FIELD = 'border border-zinc-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const yen = (n: number) => `¥${Math.round(n).toLocaleString('ja-JP')}`

/** 候補集約・比較：提示単価で並べて確定/辞退。固定単価モデルの粗利を表示（ADR-0010） */
export default function CandidatesSection({
  assignmentId,
  agencies,
  staffList,
  items,
  clientTotalFee,
  requiredCount,
}: {
  assignmentId: string
  agencies: { id: string; name: string }[]
  staffList: { id: string; name: string; default_fixed_rate?: string | number | null }[]
  items: CandidateItem[]
  clientTotalFee: string | number | null
  requiredCount: number | null
}) {
  const [pending, start] = useTransition()
  const [agencyId, setAgencyId] = useState('')
  const [staffId, setStaffId] = useState('')
  const [talentName, setTalentName] = useState('')
  const [rate, setRate] = useState('')
  const [notes, setNotes] = useState('')

  const margin = useMemo(() => calcMarginFixed(clientTotalFee, items), [clientTotalFee, items])

  // 表示順：辞退を末尾に、それ以外は提示単価の安い順（null は後ろ）
  const sorted = useMemo(() => {
    const rank = (s: string | null) => (s === '辞退' ? 1 : 0)
    return [...items].sort((a, b) => {
      const r = rank(a.candidate_status) - rank(b.candidate_status)
      if (r !== 0) return r
      const pa = a.proposed_rate != null ? Number(a.proposed_rate) : Infinity
      const pb = b.proposed_rate != null ? Number(b.proposed_rate) : Infinity
      return pa - pb
    })
  }, [items])

  // 最安（候補/確定のうち提示単価最小）を強調
  const cheapest = useMemo(() => {
    const vals = items
      .filter((c) => c.candidate_status !== '辞退' && c.proposed_rate != null)
      .map((c) => Number(c.proposed_rate))
    return vals.length ? Math.min(...vals) : null
  }, [items])

  const canAdd = !!staffId || !!talentName.trim()

  const add = () => {
    if (!canAdd) return
    start(async () => {
      await addCandidate(assignmentId, {
        agency_account_id: agencyId || null,
        staff_id: staffId || null,
        talent_name: talentName.trim() || null,
        proposed_rate: rate ? Number(rate) : null,
        notes: notes || null,
      })
      setAgencyId(''); setStaffId(''); setTalentName(''); setRate(''); setNotes('')
    })
  }

  const displayName = (c: CandidateItem) => c.talent_name || c.staff_name || '（無名）'

  return (
    <section className="bg-white border border-zinc-200 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">
          候補・確定（確定 {margin.confirmedCount} / 募集 {requiredCount ?? '—'}）
        </h2>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-zinc-400 mb-4">候補がまだありません。紹介会社からの候補を提示単価とともに追加してください。</p>
      ) : (
        <table className="w-full text-sm mb-4">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="text-left px-2 py-1.5 font-medium text-zinc-600">候補者</th>
              <th className="text-left px-2 py-1.5 font-medium text-zinc-600">紹介会社</th>
              <th className="text-right px-2 py-1.5 font-medium text-zinc-600">提示単価</th>
              <th className="text-left px-2 py-1.5 font-medium text-zinc-600">状態</th>
              <th className="px-2 py-1.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {sorted.map((c) => {
              const p = c.proposed_rate != null ? Number(c.proposed_rate) : null
              const isCheapest = cheapest != null && p === cheapest && c.candidate_status !== '辞退'
              const confirmed = c.candidate_status === '確定'
              return (
                <tr key={c.id} className={confirmed ? 'bg-cyan-50/40' : c.candidate_status === '辞退' ? 'opacity-50' : ''}>
                  <td className="px-2 py-1.5">
                    {c.staff_id
                      ? <Link href={`/staff/${c.staff_id}`} className="text-blue-600 hover:underline">{displayName(c)}</Link>
                      : displayName(c)}
                    {c.notes && <span className="block text-[10px] text-zinc-400">{c.notes}</span>}
                  </td>
                  <td className="px-2 py-1.5">
                    {c.agency_account_id
                      ? <Link href={`/accounts/${c.agency_account_id}`} className="text-blue-600 hover:underline">{c.agency_name ?? '—'}</Link>
                      : (c.agency_name ?? '—')}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">
                    {p != null ? yen(p) : '—'}
                    {isCheapest && <span className="ml-1 text-[10px] text-emerald-600">最安</span>}
                  </td>
                  <td className="px-2 py-1.5">
                    <span className={`inline-block px-1.5 py-0.5 text-[10px] rounded ${candidateStatusColor(c.candidate_status)}`}>{c.candidate_status ?? '候補'}</span>
                  </td>
                  <td className="px-2 py-1.5 text-right whitespace-nowrap">
                    {c.candidate_status !== '確定' && (
                      <button disabled={pending} onClick={() => start(async () => { await confirmCandidate(c.id, assignmentId) })}
                        className="text-xs text-cyan-700 hover:underline disabled:opacity-50">確定</button>
                    )}
                    {c.candidate_status === '候補' && (
                      <button disabled={pending} onClick={() => start(async () => { await declineCandidate(c.id, assignmentId) })}
                        className="ml-2 text-xs text-zinc-500 hover:underline disabled:opacity-50">辞退</button>
                    )}
                    {(c.candidate_status === '確定' || c.candidate_status === '辞退') && (
                      <button disabled={pending} onClick={() => start(async () => { await reopenCandidate(c.id, assignmentId) })}
                        className="ml-2 text-xs text-zinc-500 hover:underline disabled:opacity-50">戻す</button>
                    )}
                    <button disabled={pending} onClick={() => start(async () => { await removeCandidate(c.id, assignmentId) })}
                      className="ml-2 text-xs text-rose-600 hover:underline disabled:opacity-50">削除</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {/* 粗利（固定単価モデル：発注 − 確定提示単価合計） */}
      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 mb-4">
        <dl className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-[10px] text-zinc-500 mb-0.5">発注単価（売上）</dt>
            <dd className="font-mono font-bold text-zinc-800">{yen(margin.revenue)}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-zinc-500 mb-0.5">提示単価計（確定のみ）</dt>
            <dd className="font-mono text-zinc-600">{yen(margin.cost)}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-zinc-500 mb-0.5">粗利</dt>
            <dd className={`font-mono font-bold ${margin.margin >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{yen(margin.margin)}</dd>
          </div>
        </dl>
      </div>

      {/* 候補を追加 */}
      <div className="border-t border-zinc-200 pt-4">
        <p className="text-xs text-zinc-500 mb-2">候補を追加（紹介会社＋提示単価で比較できます）</p>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
          <div className="sm:col-span-3">
            <label className="block text-[10px] text-zinc-400 mb-0.5">紹介会社</label>
            <select value={agencyId} onChange={(e) => setAgencyId(e.target.value)} className={`${FIELD} bg-white w-full`}>
              <option value="">—</option>
              {agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-3">
            <label className="block text-[10px] text-zinc-400 mb-0.5">登録人材から</label>
            <select value={staffId} onChange={(e) => { setStaffId(e.target.value); const s = staffList.find((x) => x.id === e.target.value); if (s?.default_fixed_rate && !rate) setRate(String(s.default_fixed_rate)) }} className={`${FIELD} bg-white w-full`}>
              <option value="">—</option>
              {staffList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[10px] text-zinc-400 mb-0.5">または候補者名</label>
            <input value={talentName} onChange={(e) => setTalentName(e.target.value)} className={`${FIELD} w-full`} placeholder="未登録の人" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[10px] text-zinc-400 mb-0.5">提示単価（円）</label>
            <input type="number" value={rate} onChange={(e) => setRate(e.target.value)} className={`${FIELD} w-full`} />
          </div>
          <div className="sm:col-span-2">
            <button onClick={add} disabled={pending || !canAdd}
              className="w-full px-3 py-1.5 text-xs bg-zinc-800 text-white rounded-md hover:bg-zinc-900 disabled:opacity-50">
              {pending ? '追加中…' : '候補を追加'}
            </button>
          </div>
        </div>
        <p className="text-[10px] text-zinc-400 mt-1">※ 登録人材を選ぶか候補者名を入力してください。候補者名のみの場合は人材として登録されます。</p>
      </div>
    </section>
  )
}
