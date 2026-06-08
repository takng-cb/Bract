import { db } from '@/lib/db'
import { opportunities, accounts, contacts, vehicles } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import OpportunityForm from '@/components/OpportunityForm'
import Breadcrumbs from '@/components/Breadcrumbs'
import { updateOpportunity } from '@/app/actions/opportunities'
import { saveCustomFieldValues } from '@/app/actions/customFieldValues'
import { getCustomFieldsWithValues } from '@/lib/customFields'
import { getAllUsers } from '@/lib/userUtils'
import { requireEditor } from '@/lib/auth'
import type { CreateState } from '@/lib/duplicateTypes'
import { activeIndustry } from '@/lib/industry'

export default async function EditOpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireEditor()
  const isAutoBody = activeIndustry === 'auto-body'
  const [opportunity, accountsList, contactsList, customData, allUsers, vehiclesList] = await Promise.all([
    db.select().from(opportunities).where(eq(opportunities.id, id)).then((r) => r[0] ?? null),
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
    db.select({ id: contacts.id, full_name: contacts.full_name })
      .from(contacts).orderBy(asc(contacts.full_name)),
    getCustomFieldsWithValues('opportunities', id),
    getAllUsers(),
    isAutoBody
      ? db.select({
          id: vehicles.id, maker: vehicles.maker, model: vehicles.model,
          license_plate: vehicles.license_plate, year: vehicles.year,
          purchase_price: vehicles.purchase_price,
        }).from(vehicles).orderBy(asc(vehicles.maker), asc(vehicles.model))
      : Promise.resolve([] as { id: string; maker: string; model: string; license_plate: string | null; year: number | null; purchase_price: string | null }[]),
  ])
  if (!opportunity) notFound()

  async function updateOpportunityAction(_: CreateState, formData: FormData): Promise<CreateState> {
    'use server'
    try {
      await saveCustomFieldValues('opportunities', id, formData)
      await updateOpportunity(id, formData)
      return null
    } catch (e) {
      if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
      return { kind: 'error', message: (e as Error).message }
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <Breadcrumbs items={[
        { label: '商談', href: '/opportunities' },
        { label: opportunity.name, href: `/opportunities/${id}` },
        { label: '編集' },
      ]} />
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">商談を編集</h1>
      <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6">
        <OpportunityForm
          action={updateOpportunityAction}
          cancelHref={`/opportunities/${id}`}
          accounts={accountsList}
          contacts={contactsList}
          users={allUsers}
          vehicles={vehiclesList.map((v) => ({
            id: v.id,
            label: [`${v.maker} ${v.model}`, v.year ? `${v.year}年式` : null, v.license_plate].filter(Boolean).join(' / '),
            purchase_price: v.purchase_price,
          }))}
          defaultValues={{
            ...opportunity,
            close_date: opportunity.close_date ?? null,
            amount: opportunity.amount !== null ? Number(opportunity.amount) : null,
          }}
          customFields={customData.fields}
          customValues={customData.values}
        />
      </div>
    </div>
  )
}
