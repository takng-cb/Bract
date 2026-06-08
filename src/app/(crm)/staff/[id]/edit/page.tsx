/**
 * /staff/[id]/edit — スタッフ編集 (Issue #69)
 */
import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import { requireEditor } from '@/lib/auth'
import { db } from '@/lib/db'
import { staff, accounts } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import Breadcrumbs from '@/components/Breadcrumbs'
import StaffForm from '@/components/StaffForm'
import { updateStaff } from '@/industries/staffing/actions/staff'

export default async function EditStaffPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isModuleEnabled('staffing'))) notFound()
  const { id } = await params
  await requireEditor()

  const [row, supplierAccounts] = await Promise.all([
    db.select().from(staff).where(eq(staff.id, id)).then((r) => r[0] ?? null),
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts)
      .where(eq(accounts.status, 'active'))
      .orderBy(asc(accounts.name)),
  ])

  if (!row) notFound()

  async function action(formData: FormData) {
    'use server'
    await updateStaff(id, formData)
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <Breadcrumbs items={[
        { label: 'スタッフ',  href: '/staff' },
        { label: row.name,    href: `/staff/${id}` },
        { label: '編集' },
      ]} />
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">{row.name} を編集</h1>

      <StaffForm
        action={action}
        cancelHref={`/staff/${id}`}
        accounts={supplierAccounts}
        initial={{
          name:                  row.name,
          name_kana:             row.name_kana,
          belong_account_id:     row.belong_account_id,
          gender:                row.gender,
          birth_date:            row.birth_date,
          phone:                 row.phone,
          email:                 row.email,
          skills:                Array.isArray(row.skills) ? row.skills as string[] : null,
          available_areas:       Array.isArray(row.available_areas) ? row.available_areas as string[] : null,
          default_hourly_rate:   row.default_hourly_rate,
          default_cost_per_hour: row.default_cost_per_hour,
          status:                row.status,
          notes:                 row.notes,
        }}
      />
    </div>
  )
}
