'use client'

import Link from 'next/link'
import GroupedTable, { type ColDef } from '@/components/GroupedTable'
import type { FieldDef } from '@/components/FilterBuilder'

type Property = {
  id: string
  name: string
  property_type: string | null
  transaction_type: string | null
  status: string | null
  price: string | null
  accounts: { id: string; name: string } | null
}

const ALL_COLS: ColDef[] = [
  {
    key: 'name', label: '物件名',
    render: (r) => {
      const p = r as unknown as Property
      return <Link href={`/properties/${p.id}`} className="font-medium text-zinc-900 hover:text-blue-600">{p.name}</Link>
    },
  },
  {
    key: 'property_type', label: '物件種別',
    render: (r) => (r as unknown as Property).property_type ?? '—',
  },
  {
    key: 'transaction_type', label: '取引種別',
    render: (r) => (r as unknown as Property).transaction_type ?? '—',
  },
  {
    key: 'status', label: 'ステータス',
    render: (r) => {
      const s = (r as unknown as Property).status
      return s ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700">{s}</span> : '—'
    },
  },
  {
    key: 'price', label: '価格', align: 'right',
    render: (r) => {
      const v = (r as unknown as Property).price
      return v ? `¥${Number(v).toLocaleString()}` : '—'
    },
  },
  {
    key: 'account', label: '関連取引先',
    render: (r) => {
      const acc = (r as unknown as Property).accounts
      return acc
        ? <Link href={`/accounts/${acc.id}`} className="text-zinc-600 hover:text-blue-600">{acc.name}</Link>
        : '—'
    },
  },
]

const DEFAULT_KEYS = ['name', 'property_type', 'transaction_type', 'status', 'price']

type Props = {
  records: Record<string, unknown>[]
  groupBy: string[]
  fields: FieldDef[]
  activeKeys: string[]
}

export default function PropertiesTableView({ records, groupBy, fields, activeKeys }: Props) {
  const keys = activeKeys.length > 0 ? activeKeys : DEFAULT_KEYS
  const cols = ALL_COLS.filter((c) => keys.includes(c.key))
  return (
    <GroupedTable
      records={records}
      columns={cols}
      groupBy={groupBy}
      fields={fields}
      detailHref={(r) => `/properties/${String(r.id)}`}
    />
  )
}
