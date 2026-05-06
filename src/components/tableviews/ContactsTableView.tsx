'use client'

import Link from 'next/link'
import GroupedTable, { type ColDef } from '@/components/GroupedTable'
import type { FieldDef } from '@/components/FilterBuilder'

type Contact = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  title: string | null
  department: string | null
  birthday: string | null
  contact_type: string
  accounts: { id: string; name: string } | null
}

const ALL_COLS: ColDef[] = [
  {
    key: 'full_name', label: '氏名',
    render: (r) => {
      const c = r as unknown as Contact
      return <Link href={`/contacts/${c.id}`} className="font-medium text-zinc-900 hover:text-blue-600">{c.full_name}</Link>
    },
  },
  {
    key: 'account', label: '取引先',
    render: (r) => {
      const acc = (r as unknown as Contact).accounts
      return acc
        ? <Link href={`/accounts/${acc.id}`} className="text-zinc-600 hover:text-blue-600">{acc.name}</Link>
        : '—'
    },
  },
  {
    key: 'title', label: '役職',
    render: (r) => (r as unknown as Contact).title ?? '—',
  },
  {
    key: 'department', label: '部署',
    render: (r) => (r as unknown as Contact).department ?? '—',
  },
  {
    key: 'email', label: 'メール',
    render: (r) => {
      const v = (r as unknown as Contact).email
      return v ? <a href={`mailto:${v}`} className="text-blue-600 hover:underline">{v}</a> : '—'
    },
  },
  {
    key: 'phone', label: '電話番号',
    render: (r) => (r as unknown as Contact).phone ?? '—',
  },
  {
    key: 'birthday', label: '誕生日',
    render: (r) => (r as unknown as Contact).birthday ?? '—',
  },
]

const DEFAULT_KEYS = ['full_name', 'account', 'title', 'department', 'email', 'phone']

type Props = {
  records: Record<string, unknown>[]
  groupBy: string[]
  fields: FieldDef[]
  activeKeys: string[]
}

export default function ContactsTableView({ records, groupBy, fields, activeKeys }: Props) {
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
