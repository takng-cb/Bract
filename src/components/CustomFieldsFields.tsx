'use client'
/**
 * カスタムフィールド入力欄を既存フォームに埋め込むコンポーネント
 * フォームの <form> 内に配置し、cf_ プレフィックスで送信する
 */
import type { FieldDef } from '@/lib/objectMetadata'
import { parseFieldOptions } from '@/lib/fieldUtils'

type Props = {
  fields: FieldDef[]
  values?: Record<string, string | null>
}

const base = 'w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function CustomFieldsFields({ fields, values = {} }: Props) {
  const visible = fields.filter((f) => f.is_visible)
  if (visible.length === 0) return null

  // 先頭が section でなければ無名の区切りを挿入
  const startsWithSection = visible[0]?.field_type === 'section'

  return (
    <>
      {!startsWithSection && <div className="flex items-center gap-3 pt-2">
        <div className="flex-1 h-px bg-zinc-200" />
      </div>}

      {visible.map((field) => {
        if (field.field_type === 'section') {
          return (
            <SectionHeader key={field.id} label={field.label} />
          )
        }

        const val = values[field.api_name] ?? ''
        return (
          <div key={field.id}>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              {field.label}
              {field.is_required && <span className="ml-1 text-red-500">*</span>}
            </label>
            <FieldInput name={`cf_${field.api_name}`} field={field} value={val} />
          </div>
        )
      })}
    </>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <div className="w-1 h-5 rounded-full bg-blue-500 shrink-0" />
      <span className="text-sm font-bold text-zinc-700 tracking-wide">{label}</span>
      <div className="flex-1 h-px bg-zinc-200" />
    </div>
  )
}

function FieldInput({ name, field, value }: { name: string; field: FieldDef; value: string }) {
  switch (field.field_type) {
    case 'textarea':
      return <textarea name={name} defaultValue={value} rows={3} className={base} />
    case 'number':
      return <input type="number" name={name} defaultValue={value} step="any" className={base} />
    case 'date':
      return <input type="date" name={name} defaultValue={value} className={base} />
    case 'boolean':
      return (
        <input
          type="checkbox"
          name={name}
          defaultChecked={value === 'true' || value === '1'}
          value="true"
          className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
        />
      )
    case 'select': {
      const options = parseFieldOptions(field.options)
      return (
        <select name={name} defaultValue={value} className={base}>
          <option value="">— 未選択 —</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )
    }
    default:
      return <input type="text" name={name} defaultValue={value} className={base} />
  }
}
