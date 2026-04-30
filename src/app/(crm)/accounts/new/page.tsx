import Link from 'next/link'
import AccountForm from '@/components/AccountForm'
import { createAccount } from '@/app/actions/accounts'

async function createAccountAction(_: string | null, formData: FormData): Promise<string | null> {
  'use server'
  try {
    await createAccount(formData)
    return null
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
    return (e as Error).message
  }
}

export default function NewAccountPage() {
  return (
    <div className="p-8 max-w-2xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href="/accounts" className="hover:text-zinc-600">取引先</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700">新規作成</span>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">取引先を追加</h1>
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <AccountForm action={createAccountAction} cancelHref="/accounts" />
      </div>
    </div>
  )
}
