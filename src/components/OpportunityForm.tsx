'use client'

import { useActionState, useRef } from 'react'
import Link from 'next/link'
import type { FieldDef } from '@/lib/objectMetadata'
import SearchableSelect from '@/components/SearchableSelect'
import CustomFieldsFields from '@/components/CustomFieldsFields'
import FormFillModal from '@/components/FormFillModal'

type Account = { id: string; name: string }

type OpportunityFormProps = {
  action: (prevState: string | null, formData: FormData) => Promise<string | null>
  cancelHref: string
  accounts: Account[]
  customFields?: FieldDef[]
  customValues?: Record<string, string | null>
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

export default function OpportunityForm({ action, cancelHref, accounts, defaultValues = {}, customFields = [], customValues = {} }: OpportunityFormProps) {
  const [error, formAction, pending] = useActionState(action, null)
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">{error}</div>
      )}

      <div className="flex items-center gap-3">
        <div className="w-1 h-5 rounded-full bg-blue-500 shrink-0" />
        <span className="text-sm font-bold text-zinc-700 tracking-wide">基本情報</span>
        <div className="flex-1 h-px bg-zinc-200" />
        <FormFillModal
          formRef={formRef}
          csvFormat="商談名,ステージ,金額,完了予定日,確度(%),説明"
          fieldMap={{
            '商談名': 'name', 'ステージ': 'stage', '金額': 'amount',
            '完了予定日': 'close_date', '確度(%)': 'probability', '説明': 'description',
          }}
          valueMap={{
            stage: {
              '見込み': 'prospecting', '要件確認': 'qualification', '提案': 'proposal',
              '交渉': 'negotiation', '受注': 'closed_won', '失注': 'closed_lost',
            },
          }}
          customFields={customFields}
        />
      </div>

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
        <SearchableSelect
          name="account_id"
          defaultValue={defaultValues.account_id}
          options={accounts.map((a) => ({ value: a.id, label: a.name }))}
          placeholder="選択してください"
        />
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

      <CustomFieldsFields fields={customFields} values={customValues} />

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
