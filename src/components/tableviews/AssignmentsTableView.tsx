'use client'

import Link from 'next/link'
import GroupedTable, { type ColDef } from '@/components/GroupedTable'
import type { FieldDef } from '@/components/FilterBuilder'
import { assignmentStatusColor } from '@/industries/staffing/lib/staffingService'

type Row = {
  id: string
  assignment_no: string
  title: string | null
  service_date: string | null
  service_location: string | null
  service_type: string | null
  staff_count_required: number | null
  status: string
  client_total_fee: string | null
  client: { id: string; name: string } | null
  assigned_count: number
}

const ALL_COLS: ColDef[] = [
  {
    key: 'title', label: '案件',
    render: (r) => {
      const a = r as unknown as Row
      return (
        <>
          <Link href={`/assignments/${a.id}`} className="text-blue-600 hover:underline font-medium">{a.title ?? a.assignment_no}</Link>
          {a.title && <span className="block text-[11px] text-zinc-400 font-mono">{a.assignment_no}</span>}
        </>
      )
    },
  },
  {
    key: 'service_date', label: '業務日',
    render: (r) => <span className="whitespace-nowrap text-zinc-700">{(r as unknown as Row).service_date ?? '—'}</span>,
  },
  {
    key: 'client', label: '派遣先',
    render: (r) => {
      const c = (r as unknown as Row).client
      return c?.id ? <Link href={`/accounts/${c.id}`} className="text-zinc-700 hover:text-blue-600">{c.name}</Link> : '—'
    },
  },
  {
    key: 'service_type', label: '業務区分',
    render: (r) => <span className="text-zinc-600">{(r as unknown as Row).service_type ?? '—'}</span>,
  },
  {
    key: 'service_location', label: '場所',
    render: (r) => <span className="text-zinc-600 truncate max-w-xs block">{(r as unknown as Row).service_location ?? '—'}</span>,
  },
  {
    key: 'assigned', label: 'アサイン', align: 'right',
    render: (r) => {
      const a = r as unknown as Row
      return <span className="font-mono text-xs text-zinc-700">{a.assigned_count} / {a.staff_count_required ?? '—'}</span>
    },
  },
  {
    key: 'client_total_fee', label: '請求総額', align: 'right',
    render: (r) => {
      const fee = (r as unknown as Row).client_total_fee
      return <span className="font-mono text-zinc-700">{fee ? `¥${Number(fee).toLocaleString()}` : '—'}</span>
    },
  },
  {
    key: 'status', label: '状態',
    render: (r) => {
      const a = r as unknown as Row
      return <span className={`inline-block px-2 py-0.5 text-xs rounded ${assignmentStatusColor(a.status)}`}>{a.status}</span>
    },
  },
]

type Props = {
  records: Record<string, unknown>[]
  groupBy: string[]
  fields: FieldDef[]
  currentSortStr?: string
}

export default function AssignmentsTableView({ records, groupBy, fields, currentSortStr }: Props) {
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
