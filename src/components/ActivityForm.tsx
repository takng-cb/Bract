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
import type { ActivityType } from '@/lib/activityTypes'
import { NavIcon } from '@/lib/navIcon'

type ActivityFormProps = {
  action:          (prevState: string | null, formData: FormData) => Promise<string | null>
  cancelHref:      string
  /** 選択可能なオブジェクト種別（標準 + 有効カスタム） */
  objectTypes:     ObjectTypeOption[]
  /** オブジェクト api_name → そのレコード一覧 */
  recordsByObject: Record<string, RecordOption[]>
  /** /admin/objects で編集される活動種別。サーバ側から流す。 */
  activityTypes:   ActivityType[]
  /** 担当者ピッカー用ユーザー一覧 */
  users:           { id: string; name: string }[]
  defaultValues?: {
    type?:            string
    subject?:         string
    body?:            string | null
    occurred_at?:     string
    owner_id?:        string | null
    related_records?: RelatedRecordSelection[]
  }
}

export default function ActivityForm({
  action,
  cancelHref,
  objectTypes,
  recordsByObject,
  activityTypes,
  users,
  defaultValues = {},
}: ActivityFormProps) {
  // 表示用に value→label / label→value Map を作成（FormFillModal で使用）
  const typeValueToLabel: Record<string, string> = {}
  const labelToValue: Record<string, string> = {}
  for (const t of activityTypes) {
    typeValueToLabel[t.value] = t.label
    labelToValue[t.label] = t.value
  }
  const [error, formAction, pending] = useActionState(action, null)
  const formRef = useRef<HTMLFormElement>(null)

  const now = new Date()
  const localDatetime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)

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
        title="活動情報"
        action={
          <FormFillModal
            formRef={formRef}
            csvFormat="種別,件名,内容,日時"
            fieldMap={{ '種別': 'type', '件名': 'subject', '内容': 'body', '日時': 'occurred_at' }}
            valueMap={{ type: labelToValue }}
          />
        }
      >
        <div className="space-y-4">
      {/* ── 関連レコード（画面最上部に配置） ─────────────────────────── */}
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

      {/* ── 種別 / 件名 / 内容 / 日時 ────────────────────────────────── */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          種別 <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-2 flex-wrap">
          {activityTypes.map((t) => (
            <label key={t.value} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="type"
                value={t.value}
                defaultChecked={(defaultValues.type ?? activityTypes[0]?.value ?? '') === t.value}
                className="accent-blue-600"
              />
              <span className="text-sm inline-flex items-center gap-1"><NavIcon icon={t.icon} className="w-4 h-4 shrink-0" />{t.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          件名 <span className="text-red-500">*</span>
        </label>
        <input
          name="subject"
          defaultValue={defaultValues.subject ?? ''}
          required
          className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="例: 初回ヒアリング実施"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">内容</label>
        <textarea
          name="body"
          rows={4}
          defaultValue={defaultValues.body ?? ''}
          className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="活動の詳細を記入してください..."
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">日時</label>
          <input
            name="occurred_at"
            type="datetime-local"
            defaultValue={defaultValues.occurred_at
              ? new Date(new Date(defaultValues.occurred_at).getTime() - new Date(defaultValues.occurred_at).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
              : localDatetime}
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
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
        </div>
      </FormSection>

      {actions}
    </form>
  )
}
