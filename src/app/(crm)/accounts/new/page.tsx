import AccountForm from '@/components/AccountForm'
import Breadcrumbs from '@/components/Breadcrumbs'
import { createAccount } from '@/app/actions/accounts'
import { saveCustomFieldValues } from '@/app/actions/customFieldValues'
import { getCustomFieldsWithValues } from '@/lib/customFields'
import { getAllUsers } from '@/lib/userUtils'
import { requireEditor } from '@/lib/auth'
import { runCreate } from '@/lib/duplicateCheck'
import type { CreateState } from '@/lib/duplicateTypes'
import { requireBookRead } from '@/lib/permissions'

export default async function NewAccountPage() {
  await requireBookRead('accounts')  // RBAC: Read 権限ガード（ADR-0023）
  await requireEditor()
  const [{ fields }, allUsers] = await Promise.all([
    getCustomFieldsWithValues('accounts', ''),
    getAllUsers(),
  ])

  async function createAccountAction(_: CreateState, formData: FormData): Promise<CreateState> {
    'use server'
    return runCreate({
      objectKey: 'accounts',
      objectLabel: '取引先',
      formData,
      create: () => createAccount(formData),
      afterCreate: fields.length > 0 ? (id) => saveCustomFieldValues('accounts', id, formData) : undefined,
      redirectTo: (id) => `/accounts/${id}`,
    })
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <Breadcrumbs items={[
        { label: '取引先', href: '/accounts' },
        { label: '新規作成' },
      ]} />
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">取引先を追加</h1>
      <AccountForm
        action={createAccountAction}
        cancelHref="/accounts"
        users={allUsers}
        customFields={fields}
      />
    </div>
  )
}
