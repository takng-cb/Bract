import { db } from '@/lib/db'
import { accounts } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import Link from 'next/link'
import VehicleForm from '@/industries/auto-body/components/VehicleForm'
import { createVehicle } from '@/industries/auto-body/actions/vehicles'
import { getAllUsers } from '@/lib/userUtils'
import { redirect } from 'next/navigation'
import { requireEditor } from '@/lib/auth'

export default async function NewVehiclePage() {
  await requireEditor()
  const [accountsList, users] = await Promise.all([
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
    getAllUsers(),
  ])

  async function action(_: string | null, formData: FormData): Promise<string | null> {
    'use server'
    try {
      const id = await createVehicle(formData)
      redirect(`/vehicles/${id}`)
    } catch (e) {
      if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
      return (e as Error).message
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href="/vehicles" className="hover:text-zinc-600">車両</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700">新規追加</span>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">車両を追加</h1>
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <VehicleForm action={action} cancelHref="/vehicles" accounts={accountsList} users={users} />
      </div>
    </div>
  )
}
