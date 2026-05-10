'use client'

import Link from 'next/link'
import GroupedTable, { type ColDef } from '@/components/GroupedTable'
import type { FieldDef } from '@/components/FilterBuilder'
import { vehicleStatusColor, daysUntilInspection } from '@/industries/auto-body/lib/autoBodyService'

type Vehicle = {
  id: string
  maker: string
  model: string
  year: number | null
  mileage: number | null
  color: string | null
  license_plate: string | null
  status: string
  purchase_price: string | null
  sale_price: string | null
  sold_price: string | null
  next_inspection_date: string | null
}

const ALL_COLS: ColDef[] = [
  {
    key: 'maker', label: 'メーカー',
    render: (r) => {
      const v = r as unknown as Vehicle
      return <Link href={`/vehicles/${v.id}`} className="font-medium text-zinc-900 hover:text-blue-600">{v.maker}</Link>
    },
  },
  {
    key: 'model', label: '車種',
    render: (r) => {
      const v = r as unknown as Vehicle
      return <Link href={`/vehicles/${v.id}`} className="text-zinc-700 hover:text-blue-600">{v.model}</Link>
    },
  },
  { key: 'year',  label: '年式', align: 'right', render: (r) => (r as unknown as Vehicle).year ?? '—' },
  {
    key: 'mileage', label: '走行距離', align: 'right',
    render: (r) => {
      const v = r as unknown as Vehicle
      return v.mileage != null ? `${Number(v.mileage).toLocaleString()} km` : '—'
    },
  },
  { key: 'color',         label: '色',       render: (r) => (r as unknown as Vehicle).color ?? '—' },
  { key: 'license_plate', label: 'ナンバー', render: (r) => (r as unknown as Vehicle).license_plate ?? '—' },
  {
    key: 'status', label: '状態',
    render: (r) => {
      const v = r as unknown as Vehicle
      return <span className={`inline-block px-2 py-0.5 text-xs rounded ${vehicleStatusColor(v.status)}`}>{v.status}</span>
    },
  },
  {
    key: 'purchase_price', label: '仕入価格', align: 'right',
    render: (r) => {
      const v = (r as unknown as Vehicle).purchase_price
      return v ? `¥${Number(v).toLocaleString()}` : '—'
    },
  },
  {
    key: 'sale_price', label: '希望売価', align: 'right',
    render: (r) => {
      const v = (r as unknown as Vehicle).sale_price
      return v ? `¥${Number(v).toLocaleString()}` : '—'
    },
  },
  {
    key: 'sold_price', label: '売却価格', align: 'right',
    render: (r) => {
      const v = (r as unknown as Vehicle).sold_price
      return v ? <span className="font-semibold text-green-700">¥{Number(v).toLocaleString()}</span> : '—'
    },
  },
  {
    key: 'next_inspection_date', label: '次回車検',
    render: (r) => {
      const v = r as unknown as Vehicle
      if (!v.next_inspection_date) return '—'
      const days = daysUntilInspection(v.next_inspection_date)
      const expired = days != null && days < 0
      const soon    = days != null && days >= 0 && days <= 30
      return (
        <span className={expired ? 'text-red-600 font-medium' : soon ? 'text-orange-600 font-medium' : ''}>
          {v.next_inspection_date}
          {days != null && (
            <span className="ml-1 text-xs text-zinc-400">({expired ? `${-days}日経過` : `あと${days}日`})</span>
          )}
        </span>
      )
    },
  },
]

const DEFAULT_KEYS = ['maker', 'model', 'year', 'license_plate', 'status', 'next_inspection_date']

type Props = {
  records: Record<string, unknown>[]
  groupBy: string[]
  fields: FieldDef[]
  activeKeys: string[]
  currentSortStr?: string
}

export default function VehiclesTableView({ records, groupBy, fields, activeKeys, currentSortStr }: Props) {
  const keys = activeKeys.length > 0 ? activeKeys : DEFAULT_KEYS
  const cols = ALL_COLS.filter((c) => keys.includes(c.key))
  return (
    <GroupedTable
      records={records}
      columns={cols}
      groupBy={groupBy}
      fields={fields}
      currentSortStr={currentSortStr}
    />
  )
}
