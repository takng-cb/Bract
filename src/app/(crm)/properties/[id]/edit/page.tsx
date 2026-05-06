import { db } from '@/lib/db'
import { properties, accounts, contacts } from '@/lib/schema'
import { eq, asc, ne, and } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import PropertyForm from '@/components/PropertyForm'
import { updateProperty } from '@/app/actions/properties'
import { saveCustomFieldValues } from '@/app/actions/customFieldValues'
import { getCustomFieldsWithValues } from '@/lib/customFields'
import { requireEditor } from '@/lib/auth'
import RecordHeader from '@/components/RecordHeader'

export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireEditor()
  const [property, accountsList, contactsList, scrivenerAccounts, scrivenerContacts, customData] = await Promise.all([
    db.select().from(properties).where(eq(properties.id, id)).then((r) => r[0] ?? null),
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts).where(ne(accounts.status, 'inactive')).orderBy(asc(accounts.name)),
    db.select({ id: contacts.id, full_name: contacts.full_name })
      .from(contacts).orderBy(asc(contacts.full_name)),
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts)
      .where(and(eq(accounts.industry, '司法書士'), ne(accounts.status, 'inactive')))
      .orderBy(asc(accounts.name)),
    db.select({ id: contacts.id, full_name: contacts.full_name })
      .from(contacts)
      .innerJoin(accounts, eq(contacts.account_id, accounts.id))
      .where(and(eq(contacts.contact_type, 'business'), eq(accounts.industry, '司法書士')))
      .orderBy(asc(contacts.full_name)),
    getCustomFieldsWithValues('properties', id),
  ])

  if (!property) notFound()

  async function updatePropertyAction(_: string | null, formData: FormData): Promise<string | null> {
    'use server'
    try {
      await saveCustomFieldValues('properties', id, formData)
      await updateProperty(id, formData)
      return null
    } catch (e) {
      if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
      return (e as Error).message
    }
  }

  const viewParam      = property.product_category === 'other' ? 'other' : 'real_estate'
  const currentAccount = accountsList.find((a) => a.id === property.account_id) ?? null
  const currentContact = contactsList.find((c) => c.id === property.contact_id) ?? null

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <RecordHeader
        crumbs={[
          { label: '物件・商品', href: `/properties?view=${viewParam}` },
          { label: property.name, href: `/properties/${id}` },
          { label: '編集' },
        ]}
      />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 break-words">{property.name}</h1>
        {(currentAccount || currentContact) && (
          <div className="flex items-center gap-3 mt-1.5 text-sm text-zinc-600 flex-wrap">
            {currentAccount && <Link href={`/accounts/${currentAccount.id}`} className="flex items-center gap-1 hover:text-blue-600 transition-colors">🏢 {currentAccount.name}</Link>}
            {currentAccount && currentContact && <span className="text-zinc-300">·</span>}
            {currentContact && <Link href={`/contacts/${currentContact.id}`} className="flex items-center gap-1 hover:text-blue-600 transition-colors">👤 {currentContact.full_name}</Link>}
          </div>
        )}
      </div>
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <PropertyForm
          action={updatePropertyAction}
          cancelHref={`/properties/${id}`}
          accounts={accountsList}
          contacts={contactsList}
          scrivenerAccounts={scrivenerAccounts}
          scrivenerContacts={scrivenerContacts}
          defaultValues={{
            ...property,
            area:                    property.area                    != null ? Number(property.area)                    : null,
            price:                   property.price                   != null ? Number(property.price)                   : null,
            building_floor_area_1f:  property.building_floor_area_1f  != null ? Number(property.building_floor_area_1f)  : null,
            building_floor_area_2f:  property.building_floor_area_2f  != null ? Number(property.building_floor_area_2f)  : null,
            building_floor_area_3f:  property.building_floor_area_3f  != null ? Number(property.building_floor_area_3f)  : null,
            building_damage_rate:    property.building_damage_rate     != null ? Number(property.building_damage_rate)    : null,
            building_debt_amount:    property.building_debt_amount     != null ? Number(property.building_debt_amount)    : null,
          }}
          customFields={customData.fields}
          customValues={customData.values}
        />
      </div>
    </div>
  )
}
