'use client'

import Link from 'next/link'
import GroupedTable, { type ColDef } from '@/components/GroupedTable'
import type { FieldDef } from '@/components/FilterBuilder'
import { stockBadgeColor } from '@/industries/auto-body/lib/partsHelpers'

type Part = {
  id: string
  part_number: string
  name: string
  category: string | null
  unit_price: string | null
  reorder_level: number | null
  stock: number
  supplier: { id: string | null; name: string | null } | null
}

const ALL_COLS: ColDef[] = [
  {
    key: 'part_number', label: '品番',
    render: (r) => {
      const p = r as unknown as Part
      return <Link href={`/parts/${p.id}`} className="font-mono text-zinc-700 hover:text-blue-600">{p.part_number}</Link>
    },
  },
  {
    key: 'name', label: '部品名',
    render: (r) => {
      const p = r as unknown as Part
      return <Link href={`/parts/${p.id}`} className="font-medium text-zinc-900 hover:text-blue-600">{p.name}</Link>
    },
  },
  { key: 'category', label: 'カテゴリ', render: (r) => (r as unknown as Part).category ?? '—' },
  {
    key: 'unit_price', label: '単価', align: 'right',
    render: (r) => {
      const v = (r as unknown as Part).unit_price
      return v ? `¥${Number(v).toLocaleString()}` : '—'
    },
  },
  {
    key: 'supplier', label: '主仕入元',
    render: (r) => {
      const s = (r as unknown as Part).supplier
      return s?.id
        ? <Link href={`/accounts/${s.id}`} className="text-zinc-600 hover:text-blue-600">{s.name}</Link>
        : '—'
    },
  },
  {
    key: 'stock', label: '在庫', align: 'right',
    render: (r) => {
      const p = r as unknown as Part
      return (
        <span className={`inline-block px-2 py-0.5 text-xs rounded font-semibold ${stockBadgeColor(p.stock, p.reorder_level ?? 0)}`}>
          {p.stock} 個
        </span>
      )
    },
  },
  {
    key: 'reorder_level', label: '発注しきい値', align: 'right',
    render: (r) => {
      const v = (r as unknown as Part).reorder_level
      return v != null ? <span className="text-xs text-zinc-400">{v}</span> : '—'
    },
  },
]

const DEFAULT_KEYS = ['part_number', 'name', 'category', 'unit_price', 'supplier', 'stock']

type Props = {
  records: Record<string, unknown>[]
  groupBy: string[]
  fields: FieldDef[]
  activeKeys: string[]
  currentSortStr?: string
}

export default function PartsTableView({ records, groupBy, fields, activeKeys, currentSortStr }: Props) {
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
