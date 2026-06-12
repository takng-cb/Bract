/**
 * /assignments/[id]/edit — 案件編集 (Issue #69 Phase 1)
 *
 * 案件本体（AssignmentForm = RecordColumns＋カード様式）+ スタッフ追加/解除セクション。
 * スタッフ側のフォームは本体フォームと入れ子にならないよう、本体フォームの外（下部）に置く。
 */
import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import { requireEditor } from '@/lib/auth'
import { db } from '@/lib/db'
import { assignments, assignment_staff, accounts, contacts, staff } from '@/lib/schema'
import { eq, asc, ne } from 'drizzle-orm'
import Link from 'next/link'
import { Package } from 'lucide-react'
import RecordHeader from '@/components/RecordHeader'
import { updateAssignment, assignStaffToAssignment, unassignStaff } from '@/industries/staffing/actions/assignments'
import AssignmentForm from '@/industries/staffing/components/AssignmentForm'
import type { CreateState } from '@/lib/duplicateTypes'
import { requireBookRead } from '@/lib/permissions'

const FORM_ID = 'record-create-form'

const FIELD_CLS = 'w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

export default async function EditAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireBookRead('assignments')  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await isModuleEnabled('staffing'))) notFound()
  const { id } = await params
  await requireEditor()

  const [row, allClients, _allContacts, allStaff, existingAssignedStaff] = await Promise.all([
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

  async function updateAction(_: CreateState, formData: FormData): Promise<CreateState> {
    'use server'
    try {
      await updateAssignment(id, formData)
      return null
    } catch (e) {
      if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
      return { kind: 'error', message: (e as Error).message }
    }
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
    <div className="p-4 md:p-8 max-w-7xl">
      {/* 詳細ページと同じヒーローヘッダ（REQ-0051）。保存はフォームに form 属性で紐付け */}
      <RecordHeader
        crumbs={[
          { label: '案件', href: '/assignments' },
          { label: row.assignment_no, href: `/assignments/${id}` },
          { label: '編集' },
        ]}
        avatar={<Package className="w-6 h-6" strokeWidth={2.25} aria-hidden />}
        title={`${row.title ?? row.assignment_no} を編集`}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/assignments/${id}`} className="px-4 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors">
              キャンセル
            </Link>
            <button
              type="submit"
              form={FORM_ID}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              保存
            </button>
          </div>
        }
      />

      {/* 案件本体編集（RecordColumns＋カード様式。保存/キャンセルはヘッダとフォーム末尾） */}
      <AssignmentForm
        action={updateAction}
        cancelHref={`/assignments/${id}`}
        clientAccounts={allClients}
        mode="edit"
        formId={FORM_ID}
        defaultValues={{
          client_account_id:    row.client_account_id,
          service_date:         row.service_date,
          service_start_time:   row.service_start_time,
          service_end_time:     row.service_end_time,
          service_type:         row.service_type,
          service_location:     row.service_location,
          service_description:  row.service_description,
          staff_count_required: row.staff_count_required,
          client_total_fee:     row.client_total_fee,
          status:               row.status,
          internal_memo:        row.internal_memo,
        }}
      />

      {/* スタッフのアサイン管理（本体フォームの外＝下部。詳細ページと同じカード様式） */}
      <section className="mt-6 bg-white border border-zinc-200 rounded-xl shadow-xs">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100">
          <h2 className="text-[13px] font-bold text-zinc-800">スタッフのアサイン</h2>
        </div>
        <div className="px-4 py-4">
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
            <form action={assignAction} className={existingAssignedStaff.length > 0 ? 'border-t border-zinc-200 pt-4' : ''}>
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
        </div>
      </section>
    </div>
  )
}
