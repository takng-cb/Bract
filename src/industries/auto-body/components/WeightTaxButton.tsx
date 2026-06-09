'use client'

/**
 * 自動車重量税を自動計算して諸費用に追加するボタン（#47 / 重量税）
 * 車種区分 × 経過年区分 × 車両重量 × 検査年数 を選んで「計算して追加」。
 * 税額は法定額（本則・経過年重課、2021-05 以降）。
 */
import { useState, useTransition } from 'react'
import { addWeightTaxFee } from '@/industries/auto-body/actions/maintenanceFees'
import {
  calcWeightTax, WT_YEARS, WT_AGE_LABEL, WT_TYPE_LABEL,
  type WtVehicleType, type WtAgeCategory, type WtYears,
} from '@/industries/auto-body/lib/weightTax'
import { NavIcon } from '@/lib/navIcon'

const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`
const FIELD = 'border border-zinc-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'

export default function WeightTaxButton({
  maintenanceId,
  defaultType = 'passenger',
  defaultAge = 'normal',
  defaultWeightKg,
}: {
  maintenanceId: string
  defaultType?: WtVehicleType
  defaultAge?: WtAgeCategory
  defaultWeightKg?: number | null
}) {
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(false)
  const [vt, setVt] = useState<WtVehicleType>(defaultType)
  const [age, setAge] = useState<WtAgeCategory>(defaultAge)
  const [years, setYears] = useState<WtYears>(2)
  const [weight, setWeight] = useState<string>(defaultWeightKg ? String(defaultWeightKg) : '')
  const [err, setErr] = useState<string | null>(null)

  const weightKg = weight ? Number(weight) : null
  const preview = calcWeightTax({ vehicleType: vt, ageCategory: age, years, weightKg })

  const add = () => {
    setErr(null)
    start(async () => {
      try { await addWeightTaxFee(maintenanceId, { vehicleType: vt, ageCategory: age, years, weightKg }); setOpen(false) }
      catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    })
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50">
        <NavIcon icon="🧾" className="w-3.5 h-3.5 shrink-0" />重量税を自動計算して追加
      </button>
    )
  }

  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 space-y-2">
      <p className="text-xs font-semibold text-zinc-600">自動車重量税の自動計算（法定額・本則/経過年重課）</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="block text-[10px] text-zinc-400 mb-0.5">車種区分</span>
          <select value={vt} onChange={(e) => setVt(e.target.value as WtVehicleType)} className={FIELD}>
            <option value="passenger">{WT_TYPE_LABEL.passenger}</option>
            <option value="kei">{WT_TYPE_LABEL.kei}</option>
          </select>
        </label>
        {vt === 'passenger' && (
          <label className="block">
            <span className="block text-[10px] text-zinc-400 mb-0.5">車両重量(kg)</span>
            <input type="number" min="1" value={weight} onChange={(e) => setWeight(e.target.value)} className={`${FIELD} w-24`} placeholder="例 1500" />
          </label>
        )}
        <label className="block">
          <span className="block text-[10px] text-zinc-400 mb-0.5">経過年区分</span>
          <select value={age} onChange={(e) => setAge(e.target.value as WtAgeCategory)} className={FIELD}>
            {(['eco', 'normal', 'over13', 'over18'] as WtAgeCategory[]).map((a) => <option key={a} value={a}>{WT_AGE_LABEL[a]}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-[10px] text-zinc-400 mb-0.5">検査年数</span>
          <select value={years} onChange={(e) => setYears(Number(e.target.value) as WtYears)} className={FIELD}>
            {WT_YEARS.map((y) => <option key={y} value={y}>{y}年</option>)}
          </select>
        </label>
        <div className="text-sm">
          <span className="block text-[10px] text-zinc-400 mb-0.5">税額</span>
          <span className="font-mono font-bold text-zinc-800">{preview ? yen(preview.amount) : '—'}</span>
        </div>
        <button type="button" onClick={add} disabled={pending || !preview}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {pending ? '追加中…' : '計算して追加'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50">
          閉じる
        </button>
      </div>
      {err && <p className="text-xs text-rose-600">{err}</p>}
      <p className="text-[10px] text-zinc-400">※ 非課税の諸費用として追加。エコカー減税（新車時の免税/軽減）は継続検査では非適用（本則税率で算出）。</p>
    </div>
  )
}
