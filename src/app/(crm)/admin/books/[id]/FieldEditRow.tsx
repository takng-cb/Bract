'use client'
import { useState, useActionState } from 'react'
import type { FieldDef } from '@/lib/bookMetadata'
import { updateFieldDef, moveFieldDef } from '@/app/actions/bookDefinitions'

const FIELD_TYPES = [
  { value: 'text',     label: 'テキスト' },
  { value: 'textarea', label: '長文テキスト' },
  { value: 'number',   label: '数値' },
  { value: 'date',     label: '日付' },
  { value: 'boolean',  label: 'チェックボックス' },
  { value: 'select',   label: '選択肢' },
  { value: 'formula',  label: '数式（計算フィールド）' },
]

type Props = {
  field:          FieldDef
  bookId:       string
  isFirst:        boolean
  isLast:         boolean
  fieldTypLabels: Record<string, string>
  deleteAction:   (fieldId: string, bookId: string) => Promise<void>
}

export default function FieldEditRow({
  field, bookId, isFirst, isLast, fieldTypLabels, deleteAction,
}: Props) {
  const [editing, setEditing] = useState(false)

  const moveUp   = moveFieldDef.bind(null, field.id, bookId, 'up')
  const moveDown = moveFieldDef.bind(null, field.id, bookId, 'down')

  if (!editing) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 hover:bg-zinc-50">
        {/* 並び替えボタン */}
        <div className="flex flex-col gap-0.5 shrink-0">
          <form action={moveUp}>
            <button
              type="submit"
              disabled={isFirst}
              title="上へ"
              className="w-6 h-5 flex items-center justify-center text-zinc-400 hover:text-zinc-700 disabled:opacity-20 disabled:cursor-not-allowed rounded hover:bg-zinc-100 text-xs"
            >
              ▲
            </button>
          </form>
          <form action={moveDown}>
            <button
              type="submit"
              disabled={isLast}
              title="下へ"
              className="w-6 h-5 flex items-center justify-center text-zinc-400 hover:text-zinc-700 disabled:opacity-20 disabled:cursor-not-allowed rounded hover:bg-zinc-100 text-xs"
            >
              ▼
            </button>
          </form>
        </div>

        {/* フィールド情報 */}
        <div className="flex-1 min-w-0">
          {field.field_type === 'section' ? (
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              ── {field.label} ──
            </p>
          ) : (
            <>
              <p className="text-sm font-medium text-zinc-800">
                {field.label}
                {field.is_required && <span className="ml-1 text-red-400 text-xs">必須</span>}
                {!field.is_visible && <span className="ml-1 text-zinc-400 text-xs">非表示</span>}
              </p>
              <p className="text-xs text-zinc-400 font-mono">
                {field.api_name} · {fieldTypLabels[field.field_type] ?? field.field_type}
                {field.is_builtin && <span className="ml-2 text-zinc-400">（組み込み）</span>}
              </p>
            </>
          )}
        </div>

        {/* 操作ボタン */}
        <div className="flex items-center gap-1 shrink-0">
          {!field.is_builtin && (
            <>
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
              >
                編集
              </button>
              <form
                action={async () => { await deleteAction(field.id, bookId) }}
                onSubmit={(e) => {
                  if (!confirm(`「${field.label}」を削除しますか？`)) e.preventDefault()
                }}
              >
                <button type="submit" className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50">
                  削除
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <FieldEditForm
      field={field}
      bookId={bookId}
      onCancel={() => setEditing(false)}
    />
  )
}

// ──────────────────────────────────────────
// インライン編集フォーム
// ──────────────────────────────────────────
function FieldEditForm({
  field,
  bookId,
  onCancel,
}: {
  field: FieldDef
  bookId: string
  onCancel: () => void
}) {
  const [fieldType, setFieldType] = useState(field.field_type)
  const boundAction = updateFieldDef.bind(null, field.id, bookId)

  const [error, dispatch, isPending] = useActionState(
    async (_prev: unknown, fd: FormData) => {
      try { await boundAction(fd); onCancel(); return null }
      catch (e: unknown) { return (e as Error).message }
    },
    null,
  )

  const base = 'w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  // select: JSON配列 → 1行1つのテキスト
  let optionsText = ''
  if (field.options && field.field_type === 'select') {
    try { optionsText = (JSON.parse(field.options) as string[]).join('\n') } catch { /* ignore */ }
  }
  // formula: options に数式文字列が直接入っている
  const formulaExpr = field.field_type === 'formula' ? (field.options ?? '') : ''

  return (
    <form action={dispatch} className="px-5 py-4 bg-blue-50/40 space-y-3">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">表示名</label>
          <input name="label" defaultValue={field.label} required className={base} />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">フィールド種別</label>
          <select name="field_type" value={fieldType} onChange={(e) => setFieldType(e.target.value)} className={base}>
            {FIELD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {fieldType === 'select' && (
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">選択肢（1行1つ）</label>
          <textarea name="options" defaultValue={optionsText} rows={4} className={base} />
        </div>
      )}

      {fieldType === 'formula' && (
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">数式</label>
          <input
            name="options"
            type="text"
            defaultValue={formulaExpr}
            required
            placeholder="例: price * quantity"
            className={base}
          />
          <p className="mt-1 text-xs text-zinc-400">
            他のフィールドの API名を使って計算式を記述します。四則演算（+ - * /）と括弧が使えます。
          </p>
        </div>
      )}

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-700">
          <input type="checkbox" name="is_required" defaultChecked={field.is_required} className="w-3.5 h-3.5 rounded" />
          必須
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-700">
          <input type="checkbox" name="is_visible" defaultChecked={field.is_visible} value="on" className="w-3.5 h-3.5 rounded" />
          表示
        </label>
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50">
          {isPending ? '保存中…' : '保存'}
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 border border-zinc-300 text-zinc-600 text-xs font-medium rounded hover:bg-zinc-50">
          キャンセル
        </button>
      </div>
    </form>
  )
}
