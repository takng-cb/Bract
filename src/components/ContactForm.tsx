'use client'

import { useActionState } from 'react'
import Link from 'next/link'

type Account = { id: string; name: string }

type ContactFormProps = {
  action: (prevState: string | null, formData: FormData) => Promise<string | null>
  cancelHref: string
  accounts: Account[]
  defaultValues?: {
    full_name?: string
    email?: string | null
    phone?: string | null
    title?: string | null
    department?: string | null
    birthday?: string | null
    description?: string | null
    account_id?: string | null
  }
}

export default function ContactForm({ action, cancelHref, accounts, defaultValues = {} }: ContactFormProps) {
  const [error, formAction, pending] = useActionState(action, null)

  return (
    <form action={formAction} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          氏名 <span className="text-red-500">*</span>
        </label>
        <input
          name="full_name"
          defaultValue={defaultValues.full_name ?? ''}
          required
          className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="例: 田中 太郎"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">取引先</label>
        <select
          name="account_id"
          defaultValue={defaultValues.account_id ?? ''}
          className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">選択してください</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">役職</label>
          <input
            name="title"
            defaultValue={defaultValues.title ?? ''}
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: 営業部長"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">部署</label>
          <input
            name="department"
            defaultValue={defaultValues.department ?? ''}
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: 営業部"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">メールアドレス</label>
          <input
            name="email"
            type="email"
            defaultValue={defaultValues.email ?? ''}
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: tanaka@example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">電話番号</label>
          <input
            name="phone"
            defaultValue={defaultValues.phone ?? ''}
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: 03-1234-5678"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">誕生日</label>
        <input
          name="birthday"
          type="date"
          defaultValue={defaultValues.birthday ?? ''}
          className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">メモ</label>
        <textarea
          name="description"
          rows={3}
          defaultValue={defaultValues.description ?? ''}
          className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="担当者に関するメモを記入してください..."
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {pending ? '保存中...' : '保存'}
        </button>
        <Link href={cancelHref} className="px-5 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors">
          キャンセル
        </Link>
      </div>
    </form>
  )
}
