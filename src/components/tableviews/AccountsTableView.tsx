'use client'

import Link from 'next/link'
import GroupedTable, { type ColDef } from '@/components/GroupedTable'
import type { FieldDef } from '@/components/FilterBuilder'

type Account = {
  id: string
  name: string
  industry: string | null
  type: string | null
  phone: string | null
  website: string | null
  address: string | null
  annual_revenue: string | null
  employee_count: number | null
  status: string
}

const STATUS: Record<string, { label: string; cls: string }> = {
  active:   { label: '有効',   cls: 'bg-green-100 text-green-700' },
  prospect: { label: '見込み', cls: 'bg-blue-100 text-blue-700' },
  inactive: { label: '無効',   cls: 'bg-zinc-100 text-zinc-500' },
}

const ALL_COLS: ColDef[] = [
  {
    key: 'name', label: '会社名',
    render: (r) => {
      const a = r as unknown as Account
      return <Link href={`/accounts/${a.id}`} className="font-medium text-zinc-900 hover:text-blue-600">{a.name}</Link>
    },
  },
  {
    key: 'industry', label: '業種',
    render: (r) => (r as Account).industry ?? '—',
  },
  {
    key: 'type', label: '種別',
    render: (r) => (r as Account).type ?? '—',
  },
  {
    key: 'phone', label: '電話番号',
    render: (r) => (r as Account).phone ?? '—',
  },
  {
    key: 'website', label: 'Webサイト',
    render: (r) => {
      const url = (r as Account).website
      return url ? <a href={url} target="_blank" rel="noopener" className="text-blue-600 hover:underline truncate block max-w-xs">{url}</a> : '—'
    },
  },
  {
    key: 'address', label: '住所',
    render: (r) => (r as Account).address ?? '—',
  },
  {
    key: 'annual_revenue', label: '年間売上', align: 'right',
    render: (r) => {
      const v = (r as Account).annual_revenue
      return v ? `¥${Number(v).toLocaleString()}` : '—'
    },
  },
  {
    key: 'employee_count', label: '従業員数', align: 'right',
    render: (r) => {
      const v = (r as Account).employee_count
      return v != null ? `${v}名` : '—'
    },
  },
  {
    key: 'status', label: 'ステータス',
    render: (r) => {
      const s = STATUS[(r as Account).status] ?? { label: (r as Account).status, cls: 'bg-zinc-100 text-zinc-500' }
      return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>
    },
  },
]

const DEFAULT_KEYS = ['name', 'industry', 'type', 'phone', 'status']

type Props = {
  records: Record<string, unknown>[]
  groupBy: string[]
  fields: FieldDef[]
  activeKeys: string[]
}

export default function AccountsTableView({ records, groupBy, fields, activeKeys }: Props) {
  const keys = activeKeys.length > 0 ? activeKeys : DEFAULT_KEYS
  const cols = ALL_COLS.filter((c) => keys.includes(c.key))
  return (
    <GroupedTable
      records={records}
      columns={cols}
      groupBy={groupBy}
      fields={fields}
    />
  )
}
