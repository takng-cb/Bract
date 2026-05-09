import { db } from '@/lib/db'
import { accounts, contacts, vehicles } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import Link from 'next/link'
import OpportunityForm from '@/components/OpportunityForm'
import { createOpportunity } from '@/app/actions/opportunities'
import { saveCustomFieldValues } from '@/app/actions/customFieldValues'
import { getCustomFieldsWithValues } from '@/lib/customFields'
import { getAllUsers } from '@/lib/userUtils'
import { redirect } from 'next/navigation'
import { requireEditor } from '@/lib/auth'
import { activeIndustry } from '@/lib/industry'

export default async function NewOpportunityPage({
  searchParams,
}: {
  searchParams: Promise<{ account_id?: string; vehicle_id?: string }>
}) {
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
        }).from(vehicles).orderBy(asc(vehicles.maker), asc(vehicles.model))
      : Promise.resolve([] as { id: string; maker: string; model: string; license_plate: string | null; year: number | null }[]),
  ])

  const vehicleOptions = vehiclesList.map((v) => ({
    id:    v.id,
    label: [
      `${v.maker} ${v.model}`,
      v.year ? `${v.year}年式` : null,
      v.license_plate,
    ].filter(Boolean).join(' / '),
  }))

  const cancelHref = account_id ? `/accounts/${account_id}` : '/opportunities'

  async function createOpportunityAction(_: string | null, formData: FormData): Promise<string | null> {
    'use server'
    try {
      const newId = await createOpportunity(formData)
      if (fields.length > 0) await saveCustomFieldValues('opportunities', newId, formData)
      redirect(`/opportunities/${newId}`)
    } catch (e) {
      if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
      return (e as Error).message
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href="/opportunities" className="hover:text-zinc-600">商談</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700">新規作成</span>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">商談を追加</h1>
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <OpportunityForm
          action={createOpportunityAction}
          cancelHref={cancelHref}
          accounts={accountsList}
          contacts={contactsList}
          users={allUsers}
          vehicles={vehicleOptions}
          defaultValues={{ account_id: account_id ?? '', vehicle_id: vehicle_id ?? null }}
          customFields={fields}
        />
      </div>
    </div>
  )
}
