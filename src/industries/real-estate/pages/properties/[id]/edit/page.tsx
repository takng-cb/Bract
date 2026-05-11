import { db } from '@/lib/db'
import { accounts, contacts } from '@/lib/schema'
import { properties } from '@/industries/real-estate/schema'
import { eq, asc, ne, and } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import PropertyForm from '@/industries/real-estate/components/PropertyForm'
import { updateProperty } from '@/industries/real-estate/actions/properties'
import { requireEditor } from '@/lib/auth'
import RecordHeader from '@/components/RecordHeader'

export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireEditor()
  // properties は real-estate overlay の専用 UI で全フィールドを扱うため、
  // 汎用カスタムフィールド (field_definitions/custom_field_values) システムは使わない。
  // 過去の migrate スクリプトが schema 列を field_definitions に複製登録した残骸が
  // 二重表示の原因になっていたため、ここでは取得・保存しない。
  const [property, accountsList, contactsList, scrivenerAccounts, scrivenerContacts] = await Promise.all([
    db.select().from(properties).where(eq(properties.id, id)).then((r) => r[0] ?? null),
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts).where(ne(accounts.status, 'inactive')).orderBy(asc(accounts.name)),
    db.select({ id: contacts.id, full_name: contacts.full_name, account_id: contacts.account_id })
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
  ])

  if (!property) notFound()

  async function updatePropertyAction(_: string | null, formData: FormData): Promise<string | null> {
    'use server'
    try {
      await updateProperty(id, formData)
      return null
    } catch (e) {
      if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
      return (e as Error).message
    }
  }

  const viewParam = property.product_category === 'other' ? 'other' : 'real_estate'

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <RecordHeader
        crumbs={[
          { label: '物件・商品', href: `/properties?view=${viewParam}` },
          { label: property.name, href: `/properties/${id}` },
          { label: '編集' },
        ]}
      />
      <h1 className="text-2xl font-bold text-zinc-900 break-words mb-6">{property.name}</h1>
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
        />
      </div>
    </div>
  )
}
