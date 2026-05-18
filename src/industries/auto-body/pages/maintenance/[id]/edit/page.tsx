import { db } from '@/lib/db'
import { maintenance_records, accounts, contacts, customer_vehicles } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Breadcrumbs from '@/components/Breadcrumbs'
import MaintenanceForm from '@/industries/auto-body/components/MaintenanceForm'
import { updateMaintenance } from '@/industries/auto-body/actions/maintenance'
import { requireEditor } from '@/lib/auth'
import { getAllUsers } from '@/lib/userUtils'
import { maintenanceDisplayName } from '@/industries/auto-body/lib/maintenanceDisplay'

export default async function EditMaintenancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireEditor()

  const [mRow, accountsList, contactsList, vehiclesList, users] = await Promise.all([
    // breadcrumb 表示名のため account/contact/vehicle も同時取得
    db.select({
      m:       maintenance_records,
      account: { id: accounts.id, name: accounts.name },
      contact: { id: contacts.id, full_name: contacts.full_name },
      vehicle: { id: customer_vehicles.id, car_model: customer_vehicles.car_model, car_name: customer_vehicles.car_name },
    })
      .from(maintenance_records)
      .leftJoin(accounts, eq(maintenance_records.account_id, accounts.id))
      .leftJoin(contacts, eq(maintenance_records.contact_id, contacts.id))
      .leftJoin(customer_vehicles, eq(maintenance_records.customer_vehicle_id, customer_vehicles.id))
      .where(eq(maintenance_records.id, id))
      .then((r) => r[0] ?? null),
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
    db.select({ id: contacts.id, full_name: contacts.full_name, account_id: contacts.account_id })
      .from(contacts).orderBy(asc(contacts.full_name)),
    db.select({
      id: customer_vehicles.id,
      plate_number: customer_vehicles.plate_number,
      car_model: customer_vehicles.car_model,
      account_id: customer_vehicles.account_id,
    })
      .from(customer_vehicles)
      .orderBy(asc(customer_vehicles.plate_number)),
    getAllUsers(),
  ])
  if (!mRow) notFound()
  const m = mRow.m
  const breadcrumbName = maintenanceDisplayName(
    m,
    mRow.account?.id ? mRow.account : null,
    mRow.contact?.id ? mRow.contact : null,
    mRow.vehicle?.id ? mRow.vehicle : null,
  )

  const vehicleOptions = vehiclesList.map((v) => ({
    id:         v.id,
    label:      [v.plate_number ?? '—', v.car_model].filter(Boolean).join(' / ') || '車両',
    account_id: v.account_id,
  }))

  async function updateAction(_: string | null, formData: FormData): Promise<string | null> {
    'use server'
    try { await updateMaintenance(id, formData); return null }
    catch (e) {
      if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
      return (e as Error).message
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <Breadcrumbs items={[
        { label: '整備', href: '/maintenance' },
        { label: breadcrumbName, href: `/maintenance/${id}` },
        { label: '編集' },
      ]} />
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">整備を編集</h1>
      <MaintenanceForm
        action={updateAction}
        cancelHref={`/maintenance/${id}`}
        vehicles={vehicleOptions}
        accounts={accountsList}
        contacts={contactsList}
        users={users}
        defaultValues={{
          customer_vehicle_id:  m.customer_vehicle_id,
          account_id:           m.account_id,
          contact_id:           m.contact_id,
          billing_account_id:   m.billing_account_id,
          intake_date:          m.intake_date,
          intake_time:          m.intake_time,
          delivery_date:        m.delivery_date,
          delivery_time:        m.delivery_time,
          pickup_location:      m.pickup_location,
          delivery_location:    m.delivery_location,
          sales_recording_date: m.sales_recording_date,
          mileage:              m.mileage,
          branch_id:            m.branch_id,
          intake_category:      m.intake_category,
          reception_owner_id:   m.reception_owner_id,
          worker_owner_id:      m.worker_owner_id,
          internal_memo:        m.internal_memo,
          work_order_note:      m.work_order_note,
          general_note:         m.general_note,
          tax_mode:             m.tax_mode,
          tax_rounding:         m.tax_rounding,
          lever_rate:           m.lever_rate,
          status:               m.status,
          owner_id:             m.owner_id,
        }}
      />
    </div>
  )
}
