import Link from 'next/link'
import { Building2 } from 'lucide-react'
import AccountForm from '@/components/AccountForm'
import RecordHeader from '@/components/RecordHeader'
import { createAccount } from '@/app/actions/accounts'
import { saveCustomFieldValues } from '@/app/actions/customFieldValues'
import { getCustomFieldsWithValues } from '@/lib/customFields'
import { getAllUsers } from '@/lib/userUtils'
import { requireEditor } from '@/lib/auth'
import { runCreate } from '@/lib/duplicateCheck'
import type { CreateState } from '@/lib/duplicateTypes'
import { requireBookRead } from '@/lib/permissions'

const FORM_ID = 'record-create-form'

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
    <div className="p-4 md:p-8 max-w-7xl">
      {/* 詳細ページと同じヒーローヘッダ（REQ-0051）。保存はフォームに form 属性で紐付け */}
      <RecordHeader
        crumbs={[{ label: '取引先', href: '/accounts' }, { label: '新規作成' }]}
        avatar={<Building2 className="w-6 h-6" strokeWidth={2.25} aria-hidden />}
        title="取引先を追加"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/accounts" className="px-4 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors">
              キャンセル
            </Link>
            <button
              type="submit"
              form={FORM_ID}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              保存
            </button>
          </div>
        }
      />

      <AccountForm
        action={createAccountAction}
        cancelHref="/accounts"
        users={allUsers}
        customFields={fields}
        formId={FORM_ID}
      />
    </div>
  )
}
