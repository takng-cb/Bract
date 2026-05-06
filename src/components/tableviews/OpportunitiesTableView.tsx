'use client'

import Link from 'next/link'
import GroupedTable, { type ColDef } from '@/components/GroupedTable'
import type { FieldDef } from '@/components/FilterBuilder'

type Opp = {
  id: string
  name: string
  stage: string
  amount: string | null
  probability: number | null
  close_date: string | null
  accounts: { id: string; name: string } | null
}

const STAGE: Record<string, { label: string; cls: string }> = {
  prospecting:   { label: '見込み',   cls: 'bg-zinc-100 text-zinc-600' },
  qualification: { label: '要件確認', cls: 'bg-blue-100 text-blue-700' },
  proposal:      { label: '提案',     cls: 'bg-yellow-100 text-yellow-700' },
  negotiation:   { label: '交渉',     cls: 'bg-orange-100 text-orange-700' },
  closed_won:    { label: '受注',     cls: 'bg-green-100 text-green-700' },
  closed_lost:   { label: '失注',     cls: 'bg-red-100 text-red-600' },
}

const ALL_COLS: ColDef[] = [
  {
    key: 'name', label: '商談名',
    render: (r) => {
      const o = r as unknown as Opp
      return <Link href={`/opportunities/${o.id}`} className="font-medium text-zinc-900 hover:text-blue-600">{o.name}</Link>
    },
  },
  {
    key: 'account', label: '取引先',
    render: (r) => {
      const acc = (r as unknown as Opp).accounts
      return acc
        ? <Link href={`/accounts/${acc.id}`} className="text-zinc-600 hover:text-blue-600">{acc.name}</Link>
        : '—'
    },
  },
  {
    key: 'stage', label: 'ステージ',
    render: (r) => {
      const s = STAGE[(r as unknown as Opp).stage] ?? { label: (r as unknown as Opp).stage, cls: 'bg-zinc-100 text-zinc-600' }
      return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>
    },
  },
  {
    key: 'amount', label: '金額', align: 'right',
    render: (r) => {
      const v = (r as unknown as Opp).amount
      return v ? <span className="font-medium">¥{Number(v).toLocaleString()}</span> : '—'
    },
  },
  {
    key: 'probability', label: '確度', align: 'right',
    render: (r) => {
      const v = (r as unknown as Opp).probability
      return v != null ? `${v}%` : '—'
    },
  },
  {
    key: 'close_date', label: '完了予定日',
    render: (r) => (r as unknown as Opp).close_date ?? '—',
  },
]

const DEFAULT_KEYS = ['name', 'account', 'stage', 'amount', 'probability', 'close_date']

type Props = {
  records: Record<string, unknown>[]
  groupBy: string[]
  fields: FieldDef[]
  activeKeys: string[]
  currentSortStr?: string
}

export default function OpportunitiesTableView({ records, groupBy, fields, activeKeys, currentSortStr }: Props) {
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
