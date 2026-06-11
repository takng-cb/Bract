import { db } from '@/lib/db'
import { accounts } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import AccountForm from '@/components/AccountForm'
import Breadcrumbs from '@/components/Breadcrumbs'
import { updateAccount } from '@/app/actions/accounts'
import { saveCustomFieldValues } from '@/app/actions/customFieldValues'
import { getCustomFieldsWithValues } from '@/lib/customFields'
import { getAllUsers } from '@/lib/userUtils'
import { requireEditor } from '@/lib/auth'
import type { CreateState } from '@/lib/duplicateTypes'
import { requireBookRead } from '@/lib/permissions'

export default async function EditAccountPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireBookRead('accounts')  // RBAC: Read 権限ガード（ADR-0023）
  const { id } = await params
  await requireEditor()
  const [account, customData, allUsers] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.id, id)).then((r) => r[0] ?? null),
    getCustomFieldsWithValues('accounts', id),
    getAllUsers(),
  ])
  if (!account) notFound()

  async function updateAccountAction(_: CreateState, formData: FormData): Promise<CreateState> {
    'use server'
    try {
      await saveCustomFieldValues('accounts', id, formData)
      await updateAccount(id, formData)
      return null
    } catch (e) {
      if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
      return { kind: 'error', message: (e as Error).message }
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <Breadcrumbs items={[
        { label: '取引先', href: '/accounts' },
        { label: account.name, href: `/accounts/${id}` },
        { label: '編集' },
      ]} />
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">取引先を編集</h1>
      <AccountForm
        action={updateAccountAction}
        cancelHref={`/accounts/${id}`}
        users={allUsers}
        defaultValues={{
          ...account,
          annual_revenue: account.annual_revenue !== null ? Number(account.annual_revenue) : null,
        }}
        customFields={customData.fields}
        customValues={customData.values}
      />
    </div>
  )
}
