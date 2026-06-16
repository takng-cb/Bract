'use client'

import { useActionState, useRef } from 'react'
import Link from 'next/link'
import SearchableSelect from '@/components/SearchableSelect'
import CreateFeedback from '@/components/CreateFeedback'
import FormSection from '@/components/FormSection'
import type { CreateAction } from '@/lib/duplicateTypes'
import { PROJECT_STAGES } from '@/lib/statusStages'

export const PROJECT_TYPES = ['分譲開発', '賃貸開発', 'リノベーション', '仲介', '管理受託', 'その他'] as const

type Account    = { id: string; name: string }
type UserOption = { id: string; name: string }

type ProjectFormProps = {
  action: CreateAction
  cancelHref: string
  accounts: Account[]
  users?: UserOption[]
  defaultValues?: {
    name?: string | null
    status?: string | null
    project_type?: string | null
    account_id?: string | null
    location?: string | null
    start_date?: string | null
    end_date?: string | null
    budget?: number | string | null
    expected_revenue?: number | string | null
    actual_cost?: number | string | null
    description?: string | null
    owner_id?: string | null
  }
}

const inputClass =
  'w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function ProjectForm({
  action, cancelHref, accounts, users = [], defaultValues = {},
}: ProjectFormProps) {
  const [state, formAction, pending] = useActionState(action, null)
  const formRef = useRef<HTMLFormElement>(null)
  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }))

  const actions = (
    <div className="flex gap-3">
      <button type="submit" disabled={pending}
        className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50">
        {pending ? '保存中...' : '保存'}
      </button>
      <Link href={cancelHref}
        className="px-5 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50">
        キャンセル
      </Link>
    </div>
  )

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <CreateFeedback state={state} formRef={formRef} />

      {actions}

      <FormSection title="プロジェクト情報">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              プロジェクト名 <span className="text-red-500">*</span>
            </label>
            <input name="name" required defaultValue={defaultValues.name ?? ''} placeholder="例: 〇〇町 分譲住宅プロジェクト" className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">種別</label>
              <select name="project_type" defaultValue={defaultValues.project_type ?? ''} className={`${inputClass} bg-white`}>
                <option value="">未設定</option>
                {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">ステータス</label>
              <select name="status" defaultValue={defaultValues.status ?? '計画'} className={`${inputClass} bg-white`}>
                {PROJECT_STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">関連取引先（施主・地主など）</label>
            <SearchableSelect name="account_id" defaultValue={defaultValues.account_id} options={accountOptions} placeholder="取引先から選択" />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">所在地</label>
            <input name="location" defaultValue={defaultValues.location ?? ''} placeholder="例: 東京都〇〇区〇〇 1-2-3" className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">担当者</label>
              <select name="owner_id" defaultValue={defaultValues.owner_id ?? ''} className={`${inputClass} bg-white`}>
                <option value="">未設定</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection title="期間">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">着手日</label>
            <input name="start_date" type="date" defaultValue={defaultValues.start_date ?? ''} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">完了予定日</label>
            <input name="end_date" type="date" defaultValue={defaultValues.end_date ?? ''} className={inputClass} />
          </div>
        </div>
      </FormSection>

      <FormSection title="収支">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">予算・総事業費（円）</label>
            <input name="budget" type="number" min="0" defaultValue={defaultValues.budget ?? ''} placeholder="例: 50000000" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">想定売上（円）</label>
            <input name="expected_revenue" type="number" min="0" defaultValue={defaultValues.expected_revenue ?? ''} placeholder="例: 65000000" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">実績原価（円）</label>
            <input name="actual_cost" type="number" min="0" defaultValue={defaultValues.actual_cost ?? ''} placeholder="例: 0" className={inputClass} />
          </div>
        </div>
      </FormSection>

      <FormSection title="備考">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">概要・メモ</label>
          <textarea name="description" rows={3} defaultValue={defaultValues.description ?? ''}
            placeholder="プロジェクトの概要、関係者、特記事項など" className={`${inputClass} resize-none`} />
        </div>
      </FormSection>

      {actions}
    </form>
  )
}
