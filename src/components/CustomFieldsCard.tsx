/**
 * 組み込みオブジェクトの詳細ページに差し込むカスタムフィールド表示カード（表示専用）
 */
import type { FieldDef } from '@/lib/bookMetadata'
import { parseFieldOptions } from '@/lib/fieldUtils'

type Props = {
  fields: FieldDef[]
  values: Record<string, string | null>
}

export default function CustomFieldsCard({ fields, values }: Props) {
  const visible = fields.filter((f) => f.is_visible)
  if (visible.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
      <div className="px-5 py-4 space-y-4">
        {visible.map((field) => {
          if (field.field_type === 'section') {
            return (
              <div key={field.id} className="pt-2 pb-1 border-b border-zinc-100">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{field.label}</p>
              </div>
            )
          }
          const val = values[field.api_name]
          return (
            <div key={field.id}>
              <dt className="text-xs text-zinc-400 mb-0.5">{field.label}</dt>
              <dd className="text-sm text-zinc-800">{formatValue(field, val)}</dd>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatValue(field: FieldDef, val: string | null | undefined): string {
  if (!val) return '—'
  switch (field.field_type) {
    case 'boolean': return val === 'true' || val === '1' ? 'はい' : 'いいえ'
    case 'number':  return Number(val).toLocaleString('ja-JP')
    case 'date':    try { return new Date(val).toLocaleDateString('ja-JP') } catch { return val }
    default:        return val
  }
}

// parseFieldOptions は念のため再エクスポート（他で使う場合のため）
export { parseFieldOptions }
