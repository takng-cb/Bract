import { db } from '@/lib/db'
import { accounts } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import Link from 'next/link'
import PartForm from '@/industries/auto-body/components/PartForm'
import { createPart } from '@/industries/auto-body/actions/parts'
import { getAllUsers } from '@/lib/userUtils'
import { requireEditor } from '@/lib/auth'
import { runCreate } from '@/lib/duplicateCheck'
import type { CreateState } from '@/lib/duplicateTypes'

export default async function NewPartPage() {
  await requireEditor()
  const [accountsList, users] = await Promise.all([
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
    getAllUsers(),
  ])

  async function action(_: CreateState, formData: FormData): Promise<CreateState> {
    'use server'
    return runCreate({
      objectKey: 'parts',
      objectLabel: '部品',
      formData,
      create: () => createPart(formData),
      redirectTo: (id) => `/parts/${id}`,
    })
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href="/parts" className="hover:text-zinc-600">部品マスタ</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700">新規追加</span>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">部品を追加</h1>
        <PartForm action={action} cancelHref="/parts" accounts={accountsList} users={users} />
    </div>
  )
}
