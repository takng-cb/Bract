/**
 * /assignments/new — 案件 新規作成 (Issue #69 Phase 1 / REQ-0018 重複検出)
 *
 * 詳細編集は /assignments/[id]/edit で行う。
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Package } from 'lucide-react'
import { isModuleEnabled } from '@/lib/modules/registry'
import { requireEditor } from '@/lib/auth'
import { db } from '@/lib/db'
import { accounts } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import RecordHeader from '@/components/RecordHeader'
import { createAssignment } from '@/industries/staffing/actions/assignments'
import AssignmentForm from '@/industries/staffing/components/AssignmentForm'
import { runCreate } from '@/lib/duplicateCheck'
import type { CreateState } from '@/lib/duplicateTypes'
import { requireBookRead } from '@/lib/permissions'

const FORM_ID = 'record-create-form'

export default async function NewAssignmentPage() {
  await requireBookRead('assignments')  // RBAC: Read 権限ガード（ADR-0023）
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
    <div className="p-4 md:p-8 max-w-7xl">
      {/* 詳細ページと同じヒーローヘッダ（REQ-0051）。保存はフォームに form 属性で紐付け */}
      <RecordHeader
        crumbs={[{ label: '案件', href: '/assignments' }, { label: '新規追加' }]}
        avatar={<Package className="w-6 h-6" strokeWidth={2.25} aria-hidden />}
        title="案件を新規追加"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/assignments" className="px-4 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors">
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

      <AssignmentForm action={action} cancelHref="/assignments" clientAccounts={clientAccounts} formId={FORM_ID} />
    </div>
  )
}
