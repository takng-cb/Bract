'use client'

import Link from 'next/link'
import GroupedTable, { type ColDef } from '@/components/GroupedTable'
import type { FieldDef } from '@/components/FilterBuilder'

type Activity = {
  id: string
  type: string
  subject: string
  body: string | null
  occurred_at: string | null
  accounts: { id: string; name: string } | null
}

const TYPE_LABEL: Record<string, string> = {
  call: '📞 電話', email: '✉️ メール', meeting: '🤝 打合せ', note: '📝 メモ',
}

const ALL_COLS: ColDef[] = [
  {
    key: 'subject', label: '件名',
    render: (r) => {
      const a = r as unknown as Activity
      return <Link href={`/activities/${a.id}`} className="font-medium text-zinc-900 hover:text-blue-600">{a.subject}</Link>
    },
  },
  {
    key: 'type', label: '種別',
    render: (r) => {
      const t = (r as unknown as Activity).type
      return <span className="text-sm">{TYPE_LABEL[t] ?? t}</span>
    },
  },
  {
    key: 'account', label: '取引先',
    render: (r) => {
      const acc = (r as unknown as Activity).accounts
      return acc
        ? <Link href={`/accounts/${acc.id}`} className="text-zinc-600 hover:text-blue-600">{acc.name}</Link>
        : '—'
    },
  },
  {
    key: 'occurred_at', label: '日時',
    render: (r) => {
      const v = (r as unknown as Activity).occurred_at
      return v ? new Date(v).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
    },
  },
]

const DEFAULT_KEYS = ['subject', 'type', 'account', 'occurred_at']

type Props = {
  records: Record<string, unknown>[]
  groupBy: string[]
  fields: FieldDef[]
  activeKeys: string[]
  currentSortStr?: string
}

export default function ActivitiesTableView({ records, groupBy, fields, activeKeys, currentSortStr }: Props) {
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
