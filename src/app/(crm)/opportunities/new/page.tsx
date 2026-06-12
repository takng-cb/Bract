import { db } from '@/lib/db'
import { accounts, contacts, vehicles } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import Link from 'next/link'
import { Briefcase } from 'lucide-react'
import OpportunityForm from '@/components/OpportunityForm'
import RecordHeader from '@/components/RecordHeader'
import { createOpportunity } from '@/app/actions/opportunities'
import { saveCustomFieldValues } from '@/app/actions/customFieldValues'
import { getCustomFieldsWithValues } from '@/lib/customFields'
import { getAllUsers } from '@/lib/userUtils'
import { requireEditor } from '@/lib/auth'
import { activeIndustry } from '@/lib/industry'
import { runCreate } from '@/lib/duplicateCheck'
import type { CreateState } from '@/lib/duplicateTypes'
import { requireBookRead } from '@/lib/permissions'

const FORM_ID = 'record-create-form'

export default async function NewOpportunityPage({
  searchParams,
}: {
  searchParams: Promise<{ account_id?: string; vehicle_id?: string }>
}) {
  await requireBookRead('opportunities')  // RBAC: Read 権限ガード（ADR-0023）
  const { account_id, vehicle_id } = await searchParams
  await requireEditor()
  const isAutoBody = activeIndustry === 'auto-body'
  const [accountsList, contactsList, { fields }, allUsers, vehiclesList] = await Promise.all([
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
    db.select({ id: contacts.id, full_name: contacts.full_name })
      .from(contacts).orderBy(asc(contacts.full_name)),
    getCustomFieldsWithValues('opportunities', ''),
    getAllUsers(),
    isAutoBody
      ? db.select({
          id: vehicles.id, maker: vehicles.maker, model: vehicles.model,
          license_plate: vehicles.license_plate, year: vehicles.year,
          purchase_price: vehicles.purchase_price,
        }).from(vehicles).orderBy(asc(vehicles.maker), asc(vehicles.model))
      : Promise.resolve([] as { id: string; maker: string; model: string; license_plate: string | null; year: number | null; purchase_price: string | null }[]),
  ])

  const vehicleOptions = vehiclesList.map((v) => ({
    id:    v.id,
    label: [
      `${v.maker} ${v.model}`,
      v.year ? `${v.year}年式` : null,
      v.license_plate,
    ].filter(Boolean).join(' / '),
    purchase_price: v.purchase_price,
  }))

  const cancelHref = account_id ? `/accounts/${account_id}` : '/opportunities'

  async function createOpportunityAction(_: CreateState, formData: FormData): Promise<CreateState> {
    'use server'
    return runCreate({
      objectKey: 'opportunities',
      objectLabel: '商談',
      formData,
      create: () => createOpportunity(formData),
      afterCreate: fields.length > 0 ? (id) => saveCustomFieldValues('opportunities', id, formData) : undefined,
      redirectTo: (id) => `/opportunities/${id}`,
    })
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      {/* 詳細ページと同じヒーローヘッダ（REQ-0051）。保存はフォームに form 属性で紐付け */}
      <RecordHeader
        crumbs={[{ label: '商談', href: '/opportunities' }, { label: '新規作成' }]}
        avatar={<Briefcase className="w-6 h-6" strokeWidth={2.25} aria-hidden />}
        title="商談を追加"
        actions={
          <div className="flex items-center gap-2">
            <Link href={cancelHref} className="px-4 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors">
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

      <OpportunityForm
        action={createOpportunityAction}
        cancelHref={cancelHref}
        accounts={accountsList}
        contacts={contactsList}
        users={allUsers}
        vehicles={vehicleOptions}
        defaultValues={{ account_id: account_id ?? '', vehicle_id: vehicle_id ?? null }}
        customFields={fields}
        formId={FORM_ID}
      />
    </div>
  )
}
