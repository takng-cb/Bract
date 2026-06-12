/**
 * /staff/new — スタッフ新規登録 (Issue #69)
 */
import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import { requireEditor } from '@/lib/auth'
import { db } from '@/lib/db'
import { accounts } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import Link from 'next/link'
import { UserRound } from 'lucide-react'
import RecordHeader from '@/components/RecordHeader'
import StaffForm from '@/components/StaffForm'
import { createStaff } from '@/industries/staffing/actions/staff'
import { requireBookRead } from '@/lib/permissions'

const FORM_ID = 'record-create-form'

export default async function NewStaffPage() {
  await requireBookRead('staff')  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await isModuleEnabled('staffing'))) notFound()
  await requireEditor()

  const supplierAccounts = await db.select({ id: accounts.id, name: accounts.name })
    .from(accounts)
    .where(eq(accounts.status, 'active'))
    .orderBy(asc(accounts.name))

  async function action(formData: FormData): Promise<string> {
    'use server'
    return createStaff(formData)
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      {/* 詳細ページと同じヒーローヘッダ（REQ-0051）。保存はフォームに form 属性で紐付け */}
      <RecordHeader
        crumbs={[{ label: 'スタッフ', href: '/staff' }, { label: '新規登録' }]}
        avatar={<UserRound className="w-6 h-6" strokeWidth={2.25} aria-hidden />}
        title="スタッフを追加"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/staff" className="px-4 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors">
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

      <StaffForm
        action={action}
        cancelHref="/staff"
        accounts={supplierAccounts}
        formId={FORM_ID}
      />
    </div>
  )
}
