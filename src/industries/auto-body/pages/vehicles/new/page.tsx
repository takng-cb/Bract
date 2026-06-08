import { db } from '@/lib/db'
import { accounts } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import Link from 'next/link'
import VehicleForm from '@/industries/auto-body/components/VehicleForm'
import { createVehicle } from '@/industries/auto-body/actions/vehicles'
import { getAllUsers } from '@/lib/userUtils'
import { requireEditor } from '@/lib/auth'
import { runCreate } from '@/lib/duplicateCheck'
import type { CreateState } from '@/lib/duplicateTypes'

export default async function NewVehiclePage() {
  await requireEditor()
  const [accountsList, users] = await Promise.all([
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
    getAllUsers(),
  ])

  async function action(_: CreateState, formData: FormData): Promise<CreateState> {
    'use server'
    return runCreate({
      objectKey: 'vehicles',
      objectLabel: '車両',
      formData,
      create: () => createVehicle(formData),
      redirectTo: (id) => `/vehicles/${id}`,
    })
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href="/vehicles" className="hover:text-zinc-600">車両</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700">新規追加</span>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">車両を追加</h1>
      <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6">
        <VehicleForm action={action} cancelHref="/vehicles" accounts={accountsList} users={users} />
      </div>
    </div>
  )
}
