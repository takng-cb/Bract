'use client'

import { useActionState, useRef } from 'react'
import Link from 'next/link'
import SearchableSelect from '@/components/SearchableSelect'
import CreateFeedback from '@/components/CreateFeedback'
import FormSection from '@/components/FormSection'
import type { CreateAction } from '@/lib/duplicateTypes'

type Account = { id: string; name: string }
type UserOption = { id: string; name: string }

type PartFormProps = {
  action: CreateAction
  cancelHref: string
  accounts: Account[]
  users?: UserOption[]
  defaultValues?: {
    part_number?: string | null
    name?: string | null
    category?: string | null
    supplier_account_id?: string | null
    unit_price?: number | string | null
    description?: string | null
    reorder_level?: number | null
    owner_id?: string | null
  }
}

const inputClass = 'w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function PartForm({ action, cancelHref, accounts, users = [], defaultValues = {} }: PartFormProps) {
  const [state, formAction, pending] = useActionState(action, null)
  const formRef = useRef<HTMLFormElement>(null)

  const actions = (
    <div className="flex gap-3">
      <button type="submit" disabled={pending}
        className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50">
        {pending ? '保存中...' : '保存'}
      </button>
      <Link href={cancelHref} className="px-5 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50">
        キャンセル
      </Link>
    </div>
  )

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <CreateFeedback state={state} formRef={formRef} />

      {actions}

      <FormSection title="部品情報">
        <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            品番 <span className="text-red-500">*</span>
          </label>
          <input name="part_number" required defaultValue={defaultValues.part_number ?? ''} placeholder="例: 04465-30260" className={`${inputClass} font-mono`} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            部品名 <span className="text-red-500">*</span>
          </label>
          <input name="name" required defaultValue={defaultValues.name ?? ''} placeholder="例: フロントブレーキパッド" className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">カテゴリ</label>
          <input name="category" defaultValue={defaultValues.category ?? ''} placeholder="例: ブレーキ系" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">標準仕入単価（円・税抜）</label>
          <input name="unit_price" type="number" min="0" defaultValue={defaultValues.unit_price ?? ''} placeholder="例: 8500" className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">主仕入元</label>
          <SearchableSelect
            name="supplier_account_id"
            defaultValue={defaultValues.supplier_account_id}
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            placeholder="取引先から選択"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            発注しきい値（個）
            <span className="ml-2 text-xs font-normal text-zinc-400">在庫がこの数以下で警告</span>
          </label>
          <input name="reorder_level" type="number" min="0" defaultValue={defaultValues.reorder_level ?? 0} className={inputClass} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">担当者</label>
        <select name="owner_id" defaultValue={defaultValues.owner_id ?? ''} className={`${inputClass} bg-white`}>
          <option value="">未設定</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">備考</label>
        <textarea name="description" rows={3} defaultValue={defaultValues.description ?? ''} className={`${inputClass} resize-none`} />
      </div>
        </div>
      </FormSection>

      {actions}
    </form>
  )
}
