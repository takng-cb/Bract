import { db } from '@/lib/db'
import { accounts, contacts, customer_vehicles } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import Breadcrumbs from '@/components/Breadcrumbs'
import MaintenanceForm from '@/industries/auto-body/components/MaintenanceForm'
import { createMaintenance } from '@/industries/auto-body/actions/maintenance'
import { requireEditor } from '@/lib/auth'
import { getAllUsers } from '@/lib/userUtils'
import { redirect } from 'next/navigation'
import { withSaveToast } from '@/lib/saveToast'

export default async function NewMaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ customer_vehicle_id?: string; account_id?: string }>
}) {
  await requireEditor()
  const sp = await searchParams

  const [accountsList, contactsList, vehiclesList, users] = await Promise.all([
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
    db.select({ id: contacts.id, full_name: contacts.full_name, account_id: contacts.account_id })
      .from(contacts).orderBy(asc(contacts.full_name)),
    db.select({
      id:           customer_vehicles.id,
      plate_number: customer_vehicles.plate_number,
      car_model:    customer_vehicles.car_model,
      account_id:   customer_vehicles.account_id,
    })
      .from(customer_vehicles)
      .orderBy(asc(customer_vehicles.plate_number)),
    getAllUsers(),
  ])

  const vehicleOptions = vehiclesList.map((v) => ({
    id:         v.id,
    label:      [v.plate_number ?? '—', v.car_model].filter(Boolean).join(' / ') || '車両',
    account_id: v.account_id,
  }))

  async function createAction(_: string | null, formData: FormData): Promise<string | null> {
    'use server'
    try {
      const id = await createMaintenance(formData)
      redirect(withSaveToast(`/maintenance/${id}`, 'created'))
    } catch (e) {
      if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
      return (e as Error).message
    }
    return null
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <Breadcrumbs items={[
        { label: '整備', href: '/maintenance' },
        { label: '新規作成' },
      ]} />
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">整備を新規作成</h1>
      <MaintenanceForm
        action={createAction}
        cancelHref="/maintenance"
        vehicles={vehicleOptions}
        accounts={accountsList}
        contacts={contactsList}
        users={users}
        defaultValues={{
          customer_vehicle_id: sp.customer_vehicle_id ?? null,
          account_id: sp.account_id ?? null,
          intake_date: new Date().toISOString().slice(0, 10),
        }}
      />
    </div>
  )
}
