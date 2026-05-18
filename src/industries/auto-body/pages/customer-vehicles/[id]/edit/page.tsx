import { db } from '@/lib/db'
import { customer_vehicles, accounts, contacts } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Breadcrumbs from '@/components/Breadcrumbs'
import CustomerVehicleForm from '@/industries/auto-body/components/CustomerVehicleForm'
import { updateCustomerVehicle } from '@/industries/auto-body/actions/customerVehicles'
import { requireEditor } from '@/lib/auth'
import { getAllUsers } from '@/lib/userUtils'

export default async function EditCustomerVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireEditor()

  const [v, accountsList, contactsList, users] = await Promise.all([
    db.select().from(customer_vehicles).where(eq(customer_vehicles.id, id)).then((r) => r[0] ?? null),
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
    db.select({ id: contacts.id, full_name: contacts.full_name, account_id: contacts.account_id })
      .from(contacts).orderBy(asc(contacts.full_name)),
    getAllUsers(),
  ])
  if (!v) notFound()

  async function updateAction(_: string | null, formData: FormData): Promise<string | null> {
    'use server'
    try { await updateCustomerVehicle(id, formData); return null }
    catch (e) {
      if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
      return (e as Error).message
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <Breadcrumbs items={[
        { label: '顧客車両', href: '/customer-vehicles' },
        { label: v.plate_number ?? v.car_model ?? '車両', href: `/customer-vehicles/${id}` },
        { label: '編集' },
      ]} />
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">顧客車両を編集</h1>
      <CustomerVehicleForm
        action={updateAction}
        cancelHref={`/customer-vehicles/${id}`}
        accounts={accountsList}
        contacts={contactsList}
        users={users}
        defaultValues={{
          account_id:               v.account_id,
          contact_id:               v.contact_id,
          transport_branch:         v.transport_branch,
          classification_number:    v.classification_number,
          kana:                     v.kana,
          plate_number:             v.plate_number,
          car_name:                 v.car_name,
          car_model:                v.car_model,
          grade:                    v.grade,
          vehicle_kind:             v.vehicle_kind,
          vehicle_usage:            v.vehicle_usage,
          private_business:         v.private_business,
          body_shape:               v.body_shape,
          vin:                      v.vin,
          type_designation:         v.type_designation,
          class_category:           v.class_category,
          first_registration_year:  v.first_registration_year,
          first_registration_month: v.first_registration_month,
          inspection_due_date:      v.inspection_due_date,
          memo:                     v.memo,
          owner_id:                 v.owner_id,
        }}
      />
    </div>
  )
}
