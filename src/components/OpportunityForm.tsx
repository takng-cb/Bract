'use client'

import { useActionState } from 'react'
import Link from 'next/link'

type Account = { id: string; name: string }

type OpportunityFormProps = {
  action: (prevState: string | null, formData: FormData) => Promise<string | null>
  cancelHref: string
  accounts: Account[]
  defaultValues?: {
    name?: string
    account_id?: string | null
    stage?: string
    amount?: number | null
    close_date?: string | null
    probability?: number | null
    description?: string | null
  }
}

const STAGES = [
  { value: 'prospecting',   label: '見込み' },
  { value: 'qualification', label: '要件確認' },
  { value: 'proposal',      label: '提案' },
  { value: 'negotiation',   label: '交渉' },
  { value: 'closed_won',    label: '受注' },
  { value: 'closed_lost',   label: '失注' },
]

export default function OpportunityForm({ action, cancelHref, accounts, defaultValues = {} }: OpportunityFormProps) {
  const [error, formAction, pending] = useActionState(action, null)

  return (
    <form action={formAction} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          商談名 <span className="text-red-500">*</span>
        </label>
        <input
          name="name"
          defaultValue={defaultValues.name ?? ''}
          required
          className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="例: クラウド移行プロジェクト"
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

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">ステージ</label>
        <select
          name="stage"
          defaultValue={defaultValues.stage ?? 'prospecting'}
          className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">金額（円）</label>
          <input
            name="amount"
            type="number"
            min="0"
            defaultValue={defaultValues.amount ?? ''}
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: 1000000"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">確度（%）</label>
          <input
            name="probability"
            type="number"
            min="0"
            max="100"
            defaultValue={defaultValues.probability ?? ''}
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: 70"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">完了予定日</label>
        <input
          name="close_date"
          type="date"
          defaultValue={defaultValues.close_date ?? ''}
          className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">概要・メモ</label>
        <textarea
          name="description"
          rows={3}
          defaultValue={defaultValues.description ?? ''}
          className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="商談の詳細を記入してください..."
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
