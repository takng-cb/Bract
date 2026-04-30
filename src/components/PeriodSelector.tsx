'use client'

import { useRouter, usePathname } from 'next/navigation'

type Props = {
  year: number
  month: number
}

export default function PeriodSelector({ year, month }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const now = new Date()

  const years  = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  const go = (y: number, m: number) =>
    router.push(`${pathname}?year=${y}&month=${m}`)

  return (
    <div className="flex items-center gap-2">
      <select
        value={year}
        onChange={(e) => go(Number(e.target.value), month)}
        className="border border-zinc-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {years.map((y) => <option key={y} value={y}>{y}年</option>)}
      </select>
      <select
        value={month}
        onChange={(e) => go(year, Number(e.target.value))}
        className="border border-zinc-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {months.map((m) => <option key={m} value={m}>{m}月</option>)}
      </select>
    </div>
  )
}
