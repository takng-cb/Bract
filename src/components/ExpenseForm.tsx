'use client'

import { useActionState, useRef, useState } from 'react'
import Link from 'next/link'
import FormFillModal from '@/components/FormFillModal'
import SearchableSelect from '@/components/SearchableSelect'

type Account = { id: string; name: string }
type Contact = { id: string; full_name: string; account_id?: string | null }
type Opportunity = { id: string; name: string }

type ExpenseFormProps = {
  action: (prevState: string | null, formData: FormData) => Promise<string | null>
  cancelHref: string
  accounts: Account[]
  contacts: Contact[]
  opportunities: Opportunity[]
  defaultValues?: {
    title?: string
    amount?: number | null
    category?: string
    expense_date?: string
    account_id?: string | null
    contact_id?: string | null
    opportunity_id?: string | null
    notes?: string | null
  }
}

const CATEGORIES = ['交通費', '接待費', '通信費', '消耗品費', '広告費', '外注費', 'その他']

export default function ExpenseForm({
  action, cancelHref, accounts, contacts, opportunities, defaultValues = {}
}: ExpenseFormProps) {
  const [error, formAction, pending] = useActionState(action, null)
  const formRef = useRef<HTMLFormElement>(null)
  const [selectedAccountId, setSelectedAccountId] = useState(defaultValues.account_id ?? '')
  const filteredContacts = selectedAccountId
    ? contacts.filter((c) => c.account_id === selectedAccountId)
    : contacts

  const today = new Date().toISOString().slice(0, 10)

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">{error}</div>
      )}

      <div className="flex justify-end">
        <FormFillModal
          formRef={formRef}
          csvFormat="件名,金額,カテゴリ,日付,備考"
          fieldMap={{ '件名': 'title', '金額': 'amount', 'カテゴリ': 'category', '日付': 'expense_date', '備考': 'notes' }}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          件名 <span className="text-red-500">*</span>
        </label>
        <input
          name="title"
          defaultValue={defaultValues.title ?? ''}
          required
          className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="例: 顧客との会食"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            金額（円） <span className="text-red-500">*</span>
          </label>
          <input
            name="amount"
            type="number"
            min="1"
            defaultValue={defaultValues.amount ?? ''}
            required
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: 15000"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">カテゴリ</label>
          <select
            name="category"
            defaultValue={defaultValues.category ?? 'その他'}
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">日付</label>
        <input
          name="expense_date"
          type="date"
          defaultValue={defaultValues.expense_date ?? today}
          className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">商談</label>
        <SearchableSelect
          name="opportunity_id"
          defaultValue={defaultValues.opportunity_id}
          options={opportunities.map((o) => ({ value: o.id, label: o.name }))}
          placeholder="選択してください"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">取引先</label>
          <SearchableSelect
            name="account_id"
            defaultValue={defaultValues.account_id}
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            placeholder="選択してください"
            onSelect={setSelectedAccountId}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">担当者</label>
          <SearchableSelect
            key={selectedAccountId}
            name="contact_id"
            defaultValue={defaultValues.contact_id}
            options={filteredContacts.map((c) => ({ value: c.id, label: c.full_name }))}
            placeholder="選択してください"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">備考</label>
        <textarea
          name="notes"
          rows={3}
          defaultValue={defaultValues.notes ?? ''}
          className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="詳細や目的を記入してください..."
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
