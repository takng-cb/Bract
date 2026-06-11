'use client'

import { useActionState, useRef } from 'react'
import Link from 'next/link'
import FormFillModal from '@/components/FormFillModal'
import FormSection from '@/components/FormSection'
import SearchableSelect from '@/components/SearchableSelect'
import RelatedRecordsPicker, {
  type ObjectTypeOption,
  type RecordOption,
  type RelatedRecordSelection,
} from '@/components/RelatedRecordsPicker'

type TaskFormProps = {
  action:          (prevState: string | null, formData: FormData) => Promise<string | null>
  cancelHref:      string
  objectTypes:     ObjectTypeOption[]
  /** @deprecated オンデマンド検索化により未使用 */
  recordsByObject?: Record<string, RecordOption[]>
  users:           { id: string; name: string }[]
  defaultValues?: {
    title?:           string
    description?:     string | null
    due_date?:        string | null
    priority?:        string
    owner_id?:        string | null
    related_records?: RelatedRecordSelection[]
  }
}

const PRIORITIES = [
  { value: 'high',   label: '高', color: 'text-red-600',    dot: 'bg-red-500' },
  { value: 'medium', label: '中', color: 'text-yellow-600', dot: 'bg-amber-400' },
  { value: 'low',    label: '低', color: 'text-green-600',  dot: 'bg-green-500' },
]

export default function TaskForm({ action, cancelHref, objectTypes, recordsByObject, users, defaultValues = {} }: TaskFormProps) {
  const [error, formAction, pending] = useActionState(action, null)
  const formRef = useRef<HTMLFormElement>(null)

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
        title="ToDo情報"
        action={
          <FormFillModal
            formRef={formRef}
            csvFormat="タイトル,期日,優先度,詳細"
            fieldMap={{ 'タイトル': 'title', '期日': 'due_date', '優先度': 'priority', '詳細': 'description' }}
            valueMap={{ priority: { '高': 'high', '中': 'medium', '低': 'low' } }}
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${p.color}`}>
                  <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${p.dot}`} aria-hidden />
                  {p.label}
                </span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">担当者</label>
          <SearchableSelect
            name="owner_id"
            defaultValue={defaultValues.owner_id ?? undefined}
            options={users.map((u) => ({ value: u.id, label: u.name }))}
            placeholder="—"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          詳細・メモ <span className="text-zinc-400 font-normal text-xs">（任意・複数行可）</span>
        </label>
        <textarea
          name="description"
          defaultValue={defaultValues.description ?? ''}
          rows={4}
          placeholder="例: 添付の見積書をベースに、特記事項として配送料を別途記載する"
          className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
      </div>
        </div>
      </FormSection>

      {actions}
    </form>
  )
}
