'use client'
import { useActionState } from 'react'
import type { FieldDef } from '@/lib/objectMetadata'
import { parseFieldOptions } from '@/lib/fieldUtils'

type Props = {
  fields:       FieldDef[]
  defaultValues?: Record<string, unknown>
  action:       (prev: unknown, formData: FormData) => Promise<unknown>
  submitLabel?: string
  cancelHref?:  string
}

export default function DynamicForm({
  fields,
  defaultValues = {},
  action,
  submitLabel = '保存',
  cancelHref,
}: Props) {
  const [error, dispatch, isPending] = useActionState(
    async (_prev: unknown, fd: FormData) => {
      try { await action(_prev, fd); return null }
      catch (e: unknown) { return (e as Error).message ?? '保存に失敗しました' }
    },
    null,
  )

  const visibleFields = fields.filter((f) => f.is_visible)

  return (
    <form action={dispatch} className="space-y-5">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {visibleFields.map((field) => {
        // セクション区切り
        if (field.field_type === 'section') {
          return (
            <div key={field.id} className="pt-3 pb-1 border-b-2 border-zinc-100">
              <p className="text-sm font-semibold text-zinc-600">{field.label}</p>
            </div>
          )
        }

        const val = defaultValues[field.api_name]
        return (
          <div key={field.id}>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              {field.label}
              {field.is_required && <span className="ml-1 text-red-500">*</span>}
            </label>
            <FieldInput field={field} value={val} />
          </div>
        )
      })}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? '保存中…' : submitLabel}
        </button>
        {cancelHref && (
          <a
            href={cancelHref}
            className="px-4 py-2 border border-zinc-300 text-zinc-700 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors"
          >
            キャンセル
          </a>
        )}
      </div>
    </form>
  )
}

function FieldInput({ field, value }: { field: FieldDef; value: unknown }) {
  const base = 'w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
  const strVal = value != null ? String(value) : ''

  switch (field.field_type) {
    case 'textarea':
      return (
        <textarea
          name={field.api_name}
          defaultValue={strVal}
          required={field.is_required}
          rows={4}
          className={base}
        />
      )

    case 'number':
      return (
        <input
          type="number"
          name={field.api_name}
          defaultValue={strVal}
          required={field.is_required}
          step="any"
          className={base}
        />
      )

    case 'date':
      return (
        <input
          type="date"
          name={field.api_name}
          defaultValue={strVal}
          required={field.is_required}
          className={base}
        />
      )

    case 'boolean':
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            name={field.api_name}
            defaultChecked={!!value}
            className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-zinc-600">{field.label}</span>
        </label>
      )

    case 'select': {
      const options = parseFieldOptions(field.options)
      return (
        <select name={field.api_name} defaultValue={strVal} required={field.is_required} className={base}>
          {!field.is_required && <option value="">— 未選択 —</option>}
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )
    }

    default:
      return (
        <input
          type="text"
          name={field.api_name}
          defaultValue={strVal}
          required={field.is_required}
          className={base}
        />
      )
  }
}
