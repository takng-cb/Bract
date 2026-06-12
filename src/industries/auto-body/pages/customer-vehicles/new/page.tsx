import { db } from '@/lib/db'
import { accounts, contacts } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import Breadcrumbs from '@/components/Breadcrumbs'
import CustomerVehicleForm from '@/industries/auto-body/components/CustomerVehicleForm'
import { createCustomerVehicle } from '@/industries/auto-body/actions/customerVehicles'
import { requireEditor } from '@/lib/auth'
import { getAllUsers } from '@/lib/userUtils'
import { redirect } from 'next/navigation'
import { withSaveToast } from '@/lib/saveToast'

export default async function NewCustomerVehiclePage({
  searchParams,
}: {
  searchParams: Promise<{ account_id?: string }>
}) {
  await requireEditor()
  const { account_id } = await searchParams

  const [accountsList, contactsList, users] = await Promise.all([
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
    db.select({ id: contacts.id, full_name: contacts.full_name, account_id: contacts.account_id })
      .from(contacts).orderBy(asc(contacts.full_name)),
    getAllUsers(),
  ])

  async function createAction(_: string | null, formData: FormData): Promise<string | null> {
    'use server'
    try {
      const id = await createCustomerVehicle(formData)
      redirect(withSaveToast(`/customer-vehicles/${id}`, 'created'))
    } catch (e) {
      if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
      return (e as Error).message
    }
    return null
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <Breadcrumbs items={[
        { label: '顧客車両', href: '/customer-vehicles' },
        { label: '新規登録' },
      ]} />
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">顧客車両を新規登録</h1>
      <CustomerVehicleForm
        action={createAction}
        cancelHref={account_id ? `/accounts/${account_id}` : '/customer-vehicles'}
        accounts={accountsList}
        contacts={contactsList}
        users={users}
        defaultValues={{ account_id: account_id ?? null }}
      />
    </div>
  )
}
