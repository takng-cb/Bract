'use client'

import { useActionState, useRef, useState } from 'react'
import Link from 'next/link'
import FormFillModal from '@/components/FormFillModal'
import SearchableSelect from '@/components/SearchableSelect'

type Account = { id: string; name: string }
type Contact = { id: string; full_name: string; account_id?: string | null }
type Opportunity = { id: string; name: string }

type TaskFormProps = {
  action: (prevState: string | null, formData: FormData) => Promise<string | null>
  cancelHref: string
  accounts: Account[]
  contacts: Contact[]
  opportunities: Opportunity[]
  defaultValues?: {
    title?: string
    due_date?: string | null
    priority?: string
    account_id?: string | null
    contact_id?: string | null
    opportunity_id?: string | null
  }
}

const PRIORITIES = [
  { value: 'high',   label: '🔴 高', color: 'text-red-600' },
  { value: 'medium', label: '🟡 中', color: 'text-yellow-600' },
  { value: 'low',    label: '🟢 低', color: 'text-green-600' },
]

export default function TaskForm({ action, cancelHref, accounts, contacts, opportunities, defaultValues = {} }: TaskFormProps) {
  const [error, formAction, pending] = useActionState(action, null)
  const formRef = useRef<HTMLFormElement>(null)
  const [selectedAccountId, setSelectedAccountId] = useState(defaultValues.account_id ?? '')
  const filteredContacts = selectedAccountId
    ? contacts.filter((c) => c.account_id === selectedAccountId)
    : contacts

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">{error}</div>
      )}

      <div className="flex justify-end">
        <FormFillModal
          formRef={formRef}
          csvFormat="タイトル,期日,優先度"
          fieldMap={{ 'タイトル': 'title', '期日': 'due_date', '優先度': 'priority' }}
          valueMap={{ priority: { '高': 'high', '中': 'medium', '低': 'low' } }}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          タイトル <span className="text-red-500">*</span>
        </label>
        <input
          name="title"
          defaultValue={defaultValues.title ?? ''}
          required
          className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="例: 提案書を作成する"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">期限</label>
          <input
            name="due_date"
            type="date"
            defaultValue={defaultValues.due_date ?? ''}
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">優先度</label>
          <div className="flex gap-4">
            {PRIORITIES.map((p) => (
              <label key={p.value} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="priority"
                  value={p.value}
                  defaultChecked={(defaultValues.priority ?? 'medium') === p.value}
                  className="accent-blue-600"
                />
                <span className={`text-sm font-medium ${p.color}`}>{p.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

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

      <div className="grid grid-cols-2 gap-4">
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
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">商談</label>
          <SearchableSelect
            name="opportunity_id"
            defaultValue={defaultValues.opportunity_id}
            options={opportunities.map((o) => ({ value: o.id, label: o.name }))}
            placeholder="選択してください"
          />
        </div>
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
