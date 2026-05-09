import AccountForm from '@/components/AccountForm'
import Breadcrumbs from '@/components/Breadcrumbs'
import { createAccount } from '@/app/actions/accounts'
import { saveCustomFieldValues } from '@/app/actions/customFieldValues'
import { getCustomFieldsWithValues } from '@/lib/customFields'
import { getAllUsers } from '@/lib/userUtils'
import { redirect } from 'next/navigation'
import { requireEditor } from '@/lib/auth'

export default async function NewAccountPage() {
  await requireEditor()
  const [{ fields }, allUsers] = await Promise.all([
    getCustomFieldsWithValues('accounts', ''),
    getAllUsers(),
  ])

  async function createAccountAction(_: string | null, formData: FormData): Promise<string | null> {
    'use server'
    try {
      const newId = await createAccount(formData)
      if (fields.length > 0) await saveCustomFieldValues('accounts', newId, formData)
      redirect(`/accounts/${newId}`)
    } catch (e) {
      if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
      return (e as Error).message
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <Breadcrumbs items={[
        { label: '取引先', href: '/accounts' },
        { label: '新規作成' },
      ]} />
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">取引先を追加</h1>
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <AccountForm
          action={createAccountAction}
          cancelHref="/accounts"
          users={allUsers}
          customFields={fields}
        />
      </div>
    </div>
  )
}
