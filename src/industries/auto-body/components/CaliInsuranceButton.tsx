'use client'

/**
 * 自賠責保険料を自動計算して諸費用に追加するボタン（Issue #47）
 * 車種区分（自家用乗用/軽）× 期間（月）を選んで「計算して追加」。料率は公定（2023-04・本土）。
 */
import { useState, useTransition } from 'react'
import { addCaliInsuranceFee } from '@/industries/auto-body/actions/maintenanceFees'
import { CALI_TERMS, calcCaliPremium, type CaliVehicleClass } from '@/industries/auto-body/lib/caliInsurance'
import { NavIcon } from '@/lib/navIcon'

const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`
const FIELD = 'border border-zinc-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'

export default function CaliInsuranceButton({
  maintenanceId,
  defaultClass = 'passenger',
}: {
  maintenanceId: string
  defaultClass?: CaliVehicleClass
}) {
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(false)
  const [vc, setVc] = useState<CaliVehicleClass>(defaultClass)
  const [months, setMonths] = useState<number>(24)
  const [err, setErr] = useState<string | null>(null)

  const preview = calcCaliPremium({ vehicleClass: vc, months })

  const add = () => {
    setErr(null)
    start(async () => {
      try { await addCaliInsuranceFee(maintenanceId, vc, months); setOpen(false) }
      catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
      >
        <NavIcon icon="🛡" className="w-3.5 h-3.5 shrink-0" />自賠責を自動計算して追加
      </button>
    )
  }

  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 space-y-2">
      <p className="text-xs font-semibold text-zinc-600">自賠責保険料の自動計算（公定料率・2023-04 本土）</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="block text-[10px] text-zinc-400 mb-0.5">車種区分</span>
          <select value={vc} onChange={(e) => setVc(e.target.value as CaliVehicleClass)} className={FIELD}>
            <option value="passenger">自家用乗用</option>
            <option value="kei">軽自動車</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-[10px] text-zinc-400 mb-0.5">保険期間</span>
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className={FIELD}>
            {CALI_TERMS.map((m) => <option key={m} value={m}>{m}ヶ月</option>)}
          </select>
        </label>
        <div className="text-sm">
          <span className="block text-[10px] text-zinc-400 mb-0.5">保険料</span>
          <span className="font-mono font-bold text-zinc-800">{preview ? yen(preview.premium) : '—'}</span>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={pending || !preview}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? '追加中…' : '計算して追加'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50">
          閉じる
        </button>
      </div>
      {err && <p className="text-xs text-rose-600">{err}</p>}
      <p className="text-[10px] text-zinc-400">※ 非課税の諸費用として追加されます。沖縄・離島は別料率（未対応）。</p>
    </div>
  )
}
