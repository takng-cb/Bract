'use client'

import Link from 'next/link'
import GroupedTable, { type ColDef } from '@/components/GroupedTable'
import type { FieldDef } from '@/components/FilterBuilder'

type Task = {
  id: string
  title: string
  due_date: string | null
  priority: string
  done: boolean
  accounts: { id: string; name: string } | null
}

const PRIORITY: Record<string, { label: string; cls: string }> = {
  high:   { label: '🔴 高', cls: 'text-red-600' },
  medium: { label: '🟡 中', cls: 'text-yellow-600' },
  low:    { label: '🟢 低', cls: 'text-green-600' },
}

const ALL_COLS: ColDef[] = [
  {
    key: 'title', label: 'タイトル',
    render: (r) => {
      const t = r as unknown as Task
      return (
        <Link href={`/tasks/${t.id}`} className={`font-medium hover:text-blue-600 ${t.done ? 'line-through text-zinc-400' : 'text-zinc-900'}`}>
          {t.title}
        </Link>
      )
    },
  },
  {
    key: 'due_date', label: '期限',
    render: (r) => {
      const d = (r as unknown as Task).due_date
      if (!d) return '—'
      const isOver = !((r as unknown as Task).done) && d < new Date().toISOString().slice(0, 10)
      return <span className={isOver ? 'text-red-600 font-medium' : 'text-zinc-600'}>{d}</span>
    },
  },
  {
    key: 'priority', label: '優先度',
    render: (r) => {
      const p = PRIORITY[(r as unknown as Task).priority] ?? { label: (r as unknown as Task).priority, cls: '' }
      return <span className={`text-sm font-medium ${p.cls}`}>{p.label}</span>
    },
  },
  {
    key: 'done', label: '完了',
    render: (r) => (r as unknown as Task).done
      ? <span className="text-green-600 text-sm">✓ 完了</span>
      : <span className="text-zinc-400 text-sm">未完了</span>,
  },
  {
    key: 'account', label: '取引先',
    render: (r) => {
      const acc = (r as unknown as Task).accounts
      return acc
        ? <Link href={`/accounts/${acc.id}`} className="text-zinc-600 hover:text-blue-600">{acc.name}</Link>
        : '—'
    },
  },
]

const DEFAULT_KEYS = ['title', 'due_date', 'priority', 'done']

type Props = {
  records: Record<string, unknown>[]
  groupBy: string[]
  fields: FieldDef[]
  activeKeys: string[]
  currentSortStr?: string
}

export default function TasksTableView({ records, groupBy, fields, activeKeys, currentSortStr }: Props) {
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
