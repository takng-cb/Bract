/**
 * /staff 一覧 — staffing 業種専用 (Issue #69 Phase 1)
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { isModuleEnabled } from '@/lib/modules/registry'
import { db } from '@/lib/db'
import { staff, accounts } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import { canEdit } from '@/lib/auth'
import { staffStatusColor, STAFF_STATUSES } from '@/industries/staffing/lib/staffingService'

export const dynamic = 'force-dynamic'

export default async function StaffListPage() {
  if (!(await isModuleEnabled('staffing'))) notFound()

  const [staffList, edit] = await Promise.all([
    db.select({
      id:                 staff.id,
      name:               staff.name,
      name_kana:          staff.name_kana,
      gender:             staff.gender,
      phone:              staff.phone,
      email:              staff.email,
      skills:             staff.skills,
      available_areas:    staff.available_areas,
      default_hourly_rate: staff.default_hourly_rate,
      status:             staff.status,
      belong:             { id: accounts.id, name: accounts.name },
    })
      .from(staff)
      .leftJoin(accounts, eq(staff.belong_account_id, accounts.id))
      .orderBy(asc(staff.status), asc(staff.name)),
    canEdit(),
  ])

  // status 別件数
  const statusCount: Record<string, number> = {}
  for (const s of STAFF_STATUSES) statusCount[s] = 0
  for (const s of staffList) statusCount[s.status] = (statusCount[s.status] ?? 0) + 1

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">🧑‍💼 スタッフ</h1>
          <p className="text-sm text-zinc-500 mt-1">
            全 {staffList.length} 名 ／
            稼働中 {statusCount['稼働中']} / 一時休止 {statusCount['一時休止']} / 引退 {statusCount['引退']}
          </p>
        </div>
        {edit && (
          <Link href="/staff/new" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
            ＋ 新規追加
          </Link>
        )}
      </div>

      {staffList.length === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <p className="text-4xl mb-4">🧑‍💼</p>
          <p className="text-lg font-medium">スタッフがまだ登録されていません</p>
          <p className="text-sm mt-1">「新規追加」ボタンから登録してください</p>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-zinc-600">氏名</th>
                <th className="text-left px-3 py-2 font-medium text-zinc-600">所属</th>
                <th className="text-left px-3 py-2 font-medium text-zinc-600">スキル</th>
                <th className="text-left px-3 py-2 font-medium text-zinc-600">エリア</th>
                <th className="text-right px-3 py-2 font-medium text-zinc-600">標準時給</th>
                <th className="text-left px-3 py-2 font-medium text-zinc-600">状態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {staffList.map((s) => {
                const skills = Array.isArray(s.skills) ? s.skills as string[] : []
                const areas  = Array.isArray(s.available_areas) ? s.available_areas as string[] : []
                return (
                  <tr key={s.id} className="hover:bg-zinc-50">
                    <td className="px-3 py-2">
                      <Link href={`/staff/${s.id}`} className="font-medium text-zinc-900 hover:text-blue-600">{s.name}</Link>
                      {s.name_kana && <p className="text-xs text-zinc-400 mt-0.5">{s.name_kana}</p>}
                    </td>
                    <td className="px-3 py-2 text-zinc-600">
                      {s.belong?.id ? (
                        <Link href={`/accounts/${s.belong.id}`} className="hover:text-blue-600">{s.belong.name}</Link>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2 text-zinc-600">
                      {skills.length > 0 ? skills.slice(0, 3).join('、') + (skills.length > 3 ? ' …' : '') : '—'}
                    </td>
                    <td className="px-3 py-2 text-zinc-600">{areas.length > 0 ? areas.join('、') : '—'}</td>
                    <td className="px-3 py-2 text-right text-zinc-700 font-mono">
                      {s.default_hourly_rate ? `¥${Number(s.default_hourly_rate).toLocaleString()}/h` : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded ${staffStatusColor(s.status)}`}>{s.status}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
