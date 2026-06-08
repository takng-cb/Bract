/**
 * /assignments/new — 案件 新規作成 (Issue #69 Phase 1 / REQ-0018 重複検出)
 *
 * 簡易フォーム。詳細編集は /assignments/[id]/edit で行う。
 */
import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import { requireEditor } from '@/lib/auth'
import { db } from '@/lib/db'
import { accounts } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import Breadcrumbs from '@/components/Breadcrumbs'
import { createAssignment } from '@/industries/staffing/actions/assignments'
import AssignmentForm from '@/industries/staffing/components/AssignmentForm'
import { runCreate } from '@/lib/duplicateCheck'
import type { CreateState } from '@/lib/duplicateTypes'

export default async function NewAssignmentPage() {
  if (!(await isModuleEnabled('staffing'))) notFound()
  await requireEditor()

  const clientAccounts = await db.select({ id: accounts.id, name: accounts.name })
    .from(accounts)
    .where(eq(accounts.status, 'active'))
    .orderBy(asc(accounts.name))

  async function action(_: CreateState, formData: FormData): Promise<CreateState> {
    'use server'
    return runCreate({
      objectKey: 'assignments',
      objectLabel: '案件',
      formData,
      create: () => createAssignment(formData),
      redirectTo: (id) => `/assignments/${id}`,
    })
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <Breadcrumbs items={[
        { label: '案件',     href: '/assignments' },
        { label: '新規追加' },
      ]} />
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">案件を新規追加</h1>

      <AssignmentForm action={action} clientAccounts={clientAccounts} />
    </div>
  )
}
