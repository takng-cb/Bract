/**
 * /staff/new — スタッフ新規登録 (Issue #69)
 */
import { notFound } from 'next/navigation'
import { activeIndustry } from '@/lib/industry'
import { requireEditor } from '@/lib/auth'
import { db } from '@/lib/db'
import { accounts } from '@/lib/schema'
import { eq, asc, or } from 'drizzle-orm'
import Breadcrumbs from '@/components/Breadcrumbs'
import StaffForm from '@/components/StaffForm'
import { createStaff } from '@/industries/staffing/actions/staff'

export default async function NewStaffPage() {
  if (activeIndustry !== 'staffing') notFound()
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
    <div className="p-4 md:p-8 max-w-3xl">
      <Breadcrumbs items={[
        { label: 'スタッフ', href: '/staff' },
        { label: '新規登録' },
      ]} />
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">スタッフを新規登録</h1>

      <StaffForm
        action={action}
        cancelHref="/staff"
        accounts={supplierAccounts}
      />
    </div>
  )
}
