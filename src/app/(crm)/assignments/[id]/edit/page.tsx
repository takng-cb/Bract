/**
 * /assignments/[id]/edit — 案件編集 (Issue #69 Phase 1)
 *
 * 簡易版: 案件本体 + スタッフ追加フォーム
 */
import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import { requireEditor } from '@/lib/auth'
import { db } from '@/lib/db'
import { assignments, assignment_staff, accounts, contacts, staff } from '@/lib/schema'
import { eq, asc, ne } from 'drizzle-orm'
import Link from 'next/link'
import Breadcrumbs from '@/components/Breadcrumbs'
import { updateAssignment, assignStaffToAssignment, unassignStaff } from '@/industries/staffing/actions/assignments'

const FIELD_CLS = 'w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

export default async function EditAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isModuleEnabled('staffing'))) notFound()
  const { id } = await params
  await requireEditor()

  const [row, allClients, allContacts, allStaff, existingAssignedStaff] = await Promise.all([
    db.select().from(assignments).where(eq(assignments.id, id)).then((r) => r[0] ?? null),
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts)
      .where(eq(accounts.status, 'active'))
      .orderBy(asc(accounts.name)),
    db.select({ id: contacts.id, full_name: contacts.full_name })
      .from(contacts)
      .orderBy(asc(contacts.full_name)),
    db.select({ id: staff.id, name: staff.name, default_hourly_rate: staff.default_hourly_rate, default_cost_per_hour: staff.default_cost_per_hour })
      .from(staff)
      .where(ne(staff.status, '引退'))
      .orderBy(asc(staff.name)),
    db.select({
      id:             assignment_staff.id,
      staff_id:       assignment_staff.staff_id,
      service_hours:  assignment_staff.service_hours,
      hourly_rate:    assignment_staff.hourly_rate,
      cost_per_hour:  assignment_staff.cost_per_hour,
      status:         assignment_staff.status,
      staff_name:     staff.name,
    })
      .from(assignment_staff)
      .innerJoin(staff, eq(assignment_staff.staff_id, staff.id))
      .where(eq(assignment_staff.assignment_id, id)),
  ])

  if (!row) notFound()

  async function updateAction(formData: FormData) {
    'use server'
    await updateAssignment(id, formData)
  }
  async function assignAction(formData: FormData) {
    'use server'
    const staff_id      = (formData.get('staff_id') as string) || ''
    const service_hours = formData.get('service_hours') ? Number(formData.get('service_hours')) : null
    const hourly_rate   = formData.get('hourly_rate') ? Number(formData.get('hourly_rate')) : null
    const cost_per_hour = formData.get('cost_per_hour') ? Number(formData.get('cost_per_hour')) : null
    await assignStaffToAssignment(id, { staff_id, service_hours, hourly_rate, cost_per_hour })
  }
  async function unassignAction(formData: FormData) {
    'use server'
    const assignmentStaffId = (formData.get('assignment_staff_id') as string) || ''
    await unassignStaff(assignmentStaffId, id)
  }

  // 既にアサイン済みのスタッフ ID を除外して、追加候補リストを作る
  const assignedStaffIds = new Set(existingAssignedStaff.map((s) => s.staff_id))
  const availableStaff = allStaff.filter((s) => !assignedStaffIds.has(s.id))

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <Breadcrumbs items={[
        { label: '案件', href: '/assignments' },
        { label: row.assignment_no, href: `/assignments/${id}` },
        { label: '編集' },
      ]} />
      <h1 className="text-2xl font-bold text-zinc-900 mb-6 font-mono">{row.assignment_no} を編集</h1>

      {/* 案件本体編集 */}
      <form action={updateAction} className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 space-y-4 mb-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">案件情報</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs text-zinc-500 mb-1">派遣先（取引先）*</label>
            <select name="client_account_id" required defaultValue={row.client_account_id ?? ''} className={`${FIELD_CLS} bg-white`}>
              <option value="">— 選択 —</option>
              {allClients.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">業務日</label>
            <input type="date" name="service_date" defaultValue={row.service_date ?? ''} className={FIELD_CLS} />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">募集人数</label>
            <input type="number" name="staff_count_required" defaultValue={row.staff_count_required ?? ''} className={FIELD_CLS} />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">開始時間</label>
            <input type="time" name="service_start_time" defaultValue={row.service_start_time ?? ''} className={FIELD_CLS} />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">終了時間</label>
            <input type="time" name="service_end_time" defaultValue={row.service_end_time ?? ''} className={FIELD_CLS} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-zinc-500 mb-1">業務区分</label>
            <input name="service_type" defaultValue={row.service_type ?? ''} className={FIELD_CLS} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-zinc-500 mb-1">場所</label>
            <input name="service_location" defaultValue={row.service_location ?? ''} className={FIELD_CLS} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-zinc-500 mb-1">業務内容</label>
            <textarea name="service_description" rows={3} defaultValue={row.service_description ?? ''} className={`${FIELD_CLS} resize-y`} />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">請求総額</label>
            <input type="number" name="client_total_fee" defaultValue={row.client_total_fee ?? ''} className={FIELD_CLS} />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">ステータス</label>
            <select name="status" defaultValue={row.status} className={`${FIELD_CLS} bg-white`}>
              <option value="予約">予約</option>
              <option value="確定">確定</option>
              <option value="実施中">実施中</option>
              <option value="完了">完了</option>
              <option value="キャンセル">キャンセル</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-zinc-500 mb-1">内部メモ</label>
            <textarea name="internal_memo" rows={2} defaultValue={row.internal_memo ?? ''} className={`${FIELD_CLS} resize-y`} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
          <Link href={`/assignments/${id}`} className="px-4 py-2 text-sm border border-zinc-300 rounded-md hover:bg-zinc-50">キャンセル</Link>
          <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700">保存</button>
        </div>
      </form>

      {/* スタッフのアサイン管理 */}
      <section className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">スタッフのアサイン</h2>

        {existingAssignedStaff.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-zinc-500 mb-2">現在アサイン済み</p>
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="text-left px-2 py-1.5 font-medium text-zinc-600">スタッフ</th>
                  <th className="text-right px-2 py-1.5 font-medium text-zinc-600">時間</th>
                  <th className="text-right px-2 py-1.5 font-medium text-zinc-600">請求</th>
                  <th className="text-right px-2 py-1.5 font-medium text-zinc-600">仕入</th>
                  <th className="text-left px-2 py-1.5 font-medium text-zinc-600">状態</th>
                  <th className="px-2 py-1.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {existingAssignedStaff.map((s) => (
                  <tr key={s.id}>
                    <td className="px-2 py-1.5">{s.staff_name}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs">{s.service_hours ?? '—'}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs">{s.hourly_rate ?? '—'}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs">{s.cost_per_hour ?? '—'}</td>
                    <td className="px-2 py-1.5 text-xs">{s.status}</td>
                    <td className="px-2 py-1.5 text-right">
                      <form action={unassignAction}>
                        <input type="hidden" name="assignment_staff_id" value={s.id} />
                        <button type="submit" className="text-xs text-rose-600 hover:underline">解除</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {availableStaff.length > 0 ? (
          <form action={assignAction} className="border-t border-zinc-200 pt-4">
            <p className="text-xs text-zinc-500 mb-2">スタッフを追加</p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
              <div className="sm:col-span-1">
                <label className="block text-[10px] text-zinc-400 mb-0.5">スタッフ</label>
                <select name="staff_id" required className={`${FIELD_CLS} bg-white`}>
                  <option value="">—</option>
                  {availableStaff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 mb-0.5">時間 (h)</label>
                <input type="number" step="0.25" name="service_hours" className={FIELD_CLS} />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 mb-0.5">請求時給</label>
                <input type="number" name="hourly_rate" className={FIELD_CLS} />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 mb-0.5">仕入時給</label>
                <input type="number" name="cost_per_hour" className={FIELD_CLS} />
              </div>
            </div>
            <div className="flex justify-end mt-2">
              <button type="submit" className="px-3 py-1.5 text-xs bg-zinc-800 text-white rounded-md hover:bg-zinc-900">追加</button>
            </div>
          </form>
        ) : (
          <p className="text-xs text-zinc-400">アサイン可能なスタッフがいません（全員アサイン済みまたは引退）</p>
        )}
      </section>
    </div>
  )
}
