'use client'

import Link from 'next/link'
import GroupedTable, { type ColDef } from '@/components/GroupedTable'
import type { FieldDef } from '@/components/FilterBuilder'
import { staffStatusColor } from '@/industries/staffing/lib/staffingService'

type Row = {
  id: string
  name: string
  name_kana: string | null
  phone: string | null
  email: string | null
  skills: unknown
  available_areas: unknown
  default_hourly_rate: string | null
  status: string
  belong: { id: string; name: string } | null
}

const ALL_COLS: ColDef[] = [
  {
    key: 'name', label: '氏名',
    render: (r) => {
      const s = r as unknown as Row
      return (
        <>
          <Link href={`/staff/${s.id}`} className="font-medium text-zinc-900 hover:text-blue-600">{s.name}</Link>
          {s.name_kana && <p className="text-xs text-zinc-400 mt-0.5">{s.name_kana}</p>}
        </>
      )
    },
  },
  {
    key: 'belong', label: '所属',
    render: (r) => {
      const b = (r as unknown as Row).belong
      return b?.id ? <Link href={`/accounts/${b.id}`} className="text-zinc-600 hover:text-blue-600">{b.name}</Link> : '—'
    },
  },
  {
    key: 'skills', label: 'スキル',
    render: (r) => {
      const skills = Array.isArray((r as unknown as Row).skills) ? (r as unknown as Row).skills as string[] : []
      return <span className="text-zinc-600">{skills.length > 0 ? skills.slice(0, 3).join('、') + (skills.length > 3 ? ' …' : '') : '—'}</span>
    },
  },
  {
    key: 'areas', label: 'エリア',
    render: (r) => {
      const areas = Array.isArray((r as unknown as Row).available_areas) ? (r as unknown as Row).available_areas as string[] : []
      return <span className="text-zinc-600">{areas.length > 0 ? areas.join('、') : '—'}</span>
    },
  },
  {
    key: 'default_hourly_rate', label: '標準時給', align: 'right',
    render: (r) => {
      const rate = (r as unknown as Row).default_hourly_rate
      return <span className="font-mono text-zinc-700">{rate ? `¥${Number(rate).toLocaleString()}/h` : '—'}</span>
    },
  },
  {
    key: 'status', label: '状態',
    render: (r) => {
      const s = r as unknown as Row
      return <span className={`inline-block px-2 py-0.5 text-xs rounded ${staffStatusColor(s.status)}`}>{s.status}</span>
    },
  },
]

type Props = {
  records: Record<string, unknown>[]
  groupBy: string[]
  fields: FieldDef[]
  currentSortStr?: string
}

export default function StaffTableView({ records, groupBy, fields, currentSortStr }: Props) {
  return (
    <GroupedTable
      records={records}
      columns={ALL_COLS}
      groupBy={groupBy}
      fields={fields}
      currentSortStr={currentSortStr}
    />
  )
}
