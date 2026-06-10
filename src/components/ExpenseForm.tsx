'use client'

import { useActionState, useRef } from 'react'
import Link from 'next/link'
import FormFillModal from '@/components/FormFillModal'
import FormSection from '@/components/FormSection'
import RelatedRecordsPicker, {
  type ObjectTypeOption,
  type RecordOption,
  type RelatedRecordSelection,
} from '@/components/RelatedRecordsPicker'

type ExpenseFormProps = {
  action:          (prevState: string | null, formData: FormData) => Promise<string | null>
  cancelHref:      string
  objectTypes:     ObjectTypeOption[]
  recordsByObject: Record<string, RecordOption[]>
  defaultValues?: {
    title?:           string
    amount?:          number | null
    category?:        string
    expense_date?:    string
    notes?:           string | null
    related_records?: RelatedRecordSelection[]
  }
}

const CATEGORIES = ['交通費', '接待費', '通信費', '消耗品費', '広告費', '外注費', 'その他']

export default function ExpenseForm({
  action, cancelHref, objectTypes, recordsByObject, defaultValues = {},
}: ExpenseFormProps) {
  const [error, formAction, pending] = useActionState(action, null)
  const formRef = useRef<HTMLFormElement>(null)
  const today = new Date().toISOString().slice(0, 10)

  const actions = (
    <div className="flex gap-3">
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
  )

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">{error}</div>
      )}

      {actions}

      <FormSection
        title="経費情報"
        action={
          <FormFillModal
            formRef={formRef}
            csvFormat="件名,金額,カテゴリ,日付,備考"
            fieldMap={{ '件名': 'title', '金額': 'amount', 'カテゴリ': 'category', '日付': 'expense_date', '備考': 'notes' }}
          />
        }
      >
        <div className="space-y-4">
      {/* ── 関連レコード（画面最上部） ─────────────────────────────── */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-2">
          関連レコード
          <span className="ml-2 text-xs text-zinc-500 font-normal">標準 / カスタムオブジェクトのレコードを複数選択できます</span>
        </label>
        <RelatedRecordsPicker
          name="related_records"
          objectTypes={objectTypes}
          recordsByObject={recordsByObject}
          defaultValue={defaultValues.related_records ?? []}
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
        <label className="block text-sm font-medium text-zinc-700 mb-1">備考</label>
        <textarea
          name="notes"
          rows={3}
          defaultValue={defaultValues.notes ?? ''}
          className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="詳細や目的を記入してください..."
        />
      </div>
        </div>
      </FormSection>

      {actions}
    </form>
  )
}
