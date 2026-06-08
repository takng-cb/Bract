'use client'

import { useTransition } from 'react'
import { setAssignmentStatus } from '@/industries/staffing/actions/assignments'
import { ASSIGNMENT_STATUSES, assignmentStatusColor } from '@/industries/staffing/lib/staffingService'

/** 案件ステータスの進行操作（詳細ヘッダ用） */
export default function AssignmentStatusSelect({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition()
  // 旧値（予約/実施中）が来ても選択肢に出す
  const options = ASSIGNMENT_STATUSES.includes(status as never)
    ? [...ASSIGNMENT_STATUSES]
    : [status, ...ASSIGNMENT_STATUSES]

  return (
    <span className={`inline-flex items-center rounded ${assignmentStatusColor(status)} ${pending ? 'opacity-50' : ''}`}>
      <select
        value={status}
        disabled={pending}
        onChange={(e) => { const v = e.target.value; start(() => { setAssignmentStatus(id, v) }) }}
        className="bg-transparent px-2 py-0.5 text-xs font-medium focus:outline-none cursor-pointer"
        title="ステータスを変更"
      >
        {options.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    </span>
  )
}
