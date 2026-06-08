import { db } from '@/lib/db'
import { vehicles } from '@/industries/auto-body/schema'
import { accounts } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import VehicleForm from '@/industries/auto-body/components/VehicleForm'
import { updateVehicle } from '@/industries/auto-body/actions/vehicles'
import { getAllUsers } from '@/lib/userUtils'
import { requireEditor } from '@/lib/auth'
import type { CreateState } from '@/lib/duplicateTypes'

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireEditor()
  const [v, accountsList, users] = await Promise.all([
    db.select().from(vehicles).where(eq(vehicles.id, id)).then((r) => r[0] ?? null),
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
    getAllUsers(),
  ])
  if (!v) notFound()

  async function action(_: CreateState, formData: FormData): Promise<CreateState> {
    'use server'
    try {
      await updateVehicle(id, formData)
      return null
    } catch (e) {
      if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
      return { kind: 'error', message: (e as Error).message }
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href="/vehicles" className="hover:text-zinc-600">車両</Link>
        <span className="mx-2">/</span>
        <Link href={`/vehicles/${id}`} className="hover:text-zinc-600">{v.maker} {v.model}</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700">編集</span>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">車両を編集</h1>
      <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6">
        <VehicleForm
          action={action}
          cancelHref={`/vehicles/${id}`}
          accounts={accountsList}
          users={users}
          defaultValues={{
            ...v,
            year:           v.year,
            mileage:        v.mileage,
            purchase_price: v.purchase_price,
            sale_price:     v.sale_price,
            sold_price:     v.sold_price,
          }}
        />
      </div>
    </div>
  )
}
