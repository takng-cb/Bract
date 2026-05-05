import { db } from '@/lib/db'
import { properties, accounts, contacts } from '@/lib/schema'
import { eq, asc, ne, and } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import PropertyForm from '@/components/PropertyForm'
import { updateProperty } from '@/app/actions/properties'

export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [property, accountsList, contactsList, scrivenerAccounts, scrivenerContacts] = await Promise.all([
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
  ])

  if (!property) notFound()

  async function updatePropertyAction(_: string | null, formData: FormData): Promise<string | null> {
    'use server'
    try { await updateProperty(id, formData); return null }
    catch (e) {
      if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
      return (e as Error).message
    }
  }

  const viewParam = property.product_category === 'other' ? 'other' : 'real_estate'

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href={`/properties?view=${viewParam}`} className="hover:text-zinc-600">物件・商品</Link>
        <span className="mx-2">/</span>
        <Link href={`/properties/${id}`} className="hover:text-zinc-600 line-clamp-1">{property.name}</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700">編集</span>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">
        {viewParam === 'real_estate' ? '物件を編集' : '商品を編集'}
      </h1>
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
            area:               property.area               !== null ? Number(property.area)               : null,
            price:              property.price              !== null ? Number(property.price)              : null,
            building_floor_area: property.building_floor_area !== null ? Number(property.building_floor_area) : null,
          }}
        />
      </div>
    </div>
  )
}
