'use client'
import { useActionState, useState } from 'react'

const FIELD_TYPES = [
  { value: 'text',     label: 'テキスト' },
  { value: 'textarea', label: '長文テキスト' },
  { value: 'number',   label: '数値' },
  { value: 'date',     label: '日付' },
  { value: 'boolean',  label: 'チェックボックス' },
  { value: 'select',   label: '選択肢' },
  { value: 'section',  label: '─── セクション区切り' },
]

type Props = {
  objectId:     string
  createAction: (objectId: string, formData: FormData) => Promise<void>
}

export default function NewFieldForm({ objectId, createAction }: Props) {
  const [fieldType, setFieldType] = useState('text')
  const isSection = fieldType === 'section'

  const [error, dispatch, isPending] = useActionState(
    async (_prev: unknown, fd: FormData) => {
      // セクションの場合は api_name を自動生成
      if (fd.get('field_type') === 'section') {
        fd.set('api_name', `section_${Date.now()}`)
      }
      try { await createAction(objectId, fd); return null }
      catch (e: unknown) { return (e as Error).message }
    },
    null,
  )

  const base = 'w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <form action={dispatch} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* セクションのときは API名を非表示（自動生成） */}
        {!isSection && (
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">
              API名 <span className="text-red-500">*</span>
            </label>
            <input
              name="api_name"
              type="text"
              required={!isSection}
              placeholder="例: contract_date"
              pattern="[a-z][a-z0-9_]*"
              title="英小文字・数字・アンダースコアのみ（先頭は英字）"
              className={base}
            />
          </div>
        )}
        <div className={isSection ? 'col-span-2' : ''}>
          <label className="block text-xs font-medium text-zinc-600 mb-1">
            {isSection ? 'セクション名' : '表示名'} <span className="text-red-500">*</span>
          </label>
          <input
            name="label"
            type="text"
            required
            placeholder={isSection ? '例: 基本情報・詳細情報' : '例: 契約日'}
            className={base}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">種別</label>
          <select
            name="field_type"
            value={fieldType}
            onChange={(e) => setFieldType(e.target.value)}
            className={base}
          >
            {FIELD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        {!isSection && (
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-700">
              <input type="checkbox" name="is_required" className="w-4 h-4 rounded" />
              必須項目
            </label>
          </div>
        )}
      </div>

      {fieldType === 'select' && (
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">選択肢（1行1つ）</label>
          <textarea name="options" rows={4} placeholder={'例:\n対応中\n完了\nキャンセル'} className={base} />
        </div>
      )}

      {isSection && (
        <p className="text-xs text-zinc-400">
          セクション区切りはフィールド間に見出しを挿入します。値の入力はありません。
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? '追加中…' : isSection ? 'セクションを追加' : 'フィールドを追加'}
        </button>
      </div>
    </form>
  )
}
