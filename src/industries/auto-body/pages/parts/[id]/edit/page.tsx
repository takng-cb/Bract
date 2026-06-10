import { db } from '@/lib/db'
import { parts } from '@/industries/auto-body/schema'
import { accounts } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import PartForm from '@/industries/auto-body/components/PartForm'
import { updatePart } from '@/industries/auto-body/actions/parts'
import { getAllUsers } from '@/lib/userUtils'
import { requireEditor } from '@/lib/auth'
import type { CreateState } from '@/lib/duplicateTypes'

export default async function EditPartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireEditor()
  const [p, accountsList, users] = await Promise.all([
    db.select().from(parts).where(eq(parts.id, id)).then((r) => r[0] ?? null),
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
    getAllUsers(),
  ])
  if (!p) notFound()

  async function action(_: CreateState, formData: FormData): Promise<CreateState> {
    'use server'
    try {
      await updatePart(id, formData)
      return null
    } catch (e) {
      if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
      return { kind: 'error', message: (e as Error).message }
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href="/parts" className="hover:text-zinc-600">部品マスタ</Link>
        <span className="mx-2">/</span>
        <Link href={`/parts/${id}`} className="hover:text-zinc-600">{p.name}</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700">編集</span>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">部品を編集</h1>
        <PartForm action={action} cancelHref={`/parts/${id}`} accounts={accountsList} users={users} defaultValues={p} />
    </div>
  )
}
