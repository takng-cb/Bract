'use client'

import Link from 'next/link'
import GroupedTable, { type ColDef } from '@/components/GroupedTable'
import type { FieldDef } from '@/components/FilterBuilder'

type Expense = {
  id: string
  title: string
  amount: string | null
  category: string | null
  expense_date: string | null
  notes: string | null
  accounts: { id: string; name: string } | null
}

const ALL_COLS: ColDef[] = [
  {
    key: 'title', label: '件名',
    render: (r) => {
      const e = r as unknown as Expense
      return <Link href={`/expenses/${e.id}`} className="font-medium text-zinc-900 hover:text-blue-600">{e.title}</Link>
    },
  },
  {
    key: 'amount', label: '金額', align: 'right',
    render: (r) => {
      const v = (r as unknown as Expense).amount
      return v ? <span className="font-medium">¥{Number(v).toLocaleString()}</span> : '—'
    },
  },
  {
    key: 'category', label: 'カテゴリ',
    render: (r) => (r as unknown as Expense).category ?? '—',
  },
  {
    key: 'expense_date', label: '日付',
    render: (r) => (r as unknown as Expense).expense_date ?? '—',
  },
  {
    key: 'account', label: '取引先',
    render: (r) => {
      const acc = (r as unknown as Expense).accounts
      return acc
        ? <Link href={`/accounts/${acc.id}`} className="text-zinc-600 hover:text-blue-600">{acc.name}</Link>
        : '—'
    },
  },
  {
    key: 'notes', label: '備考',
    render: (r) => {
      const v = (r as unknown as Expense).notes
      return v ? <span className="text-zinc-500 truncate block max-w-xs">{v}</span> : '—'
    },
  },
]

const DEFAULT_KEYS = ['title', 'amount', 'category', 'expense_date']

type Props = {
  records: Record<string, unknown>[]
  groupBy: string[]
  fields: FieldDef[]
  activeKeys: string[]
}

export default function ExpensesTableView({ records, groupBy, fields, activeKeys }: Props) {
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
