'use client'

import Link from 'next/link'
import GroupedTable, { type ColDef } from '@/components/GroupedTable'
import type { FieldDef } from '@/components/FilterBuilder'
import { NavIcon } from '@/lib/navIcon'

type Activity = {
  id: string
  type: string
  subject: string
  body: string | null
  occurred_at: string | null
  accounts: { id: string; name: string } | null
}

const TYPE_LABEL: Record<string, { icon: string; label: string }> = {
  call: { icon: '📞', label: '電話' }, email: { icon: '✉️', label: 'メール' },
  meeting: { icon: '🤝', label: '打合せ' }, note: { icon: '📝', label: 'メモ' },
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
      const def = TYPE_LABEL[t]
      return def
        ? <span className="inline-flex items-center gap-1.5 text-sm"><NavIcon icon={def.icon} className="w-3.5 h-3.5 text-zinc-400" />{def.label}</span>
        : <span className="text-sm">{t}</span>
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
