'use client'

/**
 * クイック作成のフィールド入力（QuickAiField を 1 つレンダリング）。
 * QuickLauncher の AI 確認画面と QuickCreateRelatedModal で共用（REQ-0085）。
 */
import type { QuickAiField } from '@/app/actions/quickAi'

export default function QuickFieldInput({ field, onChange }: { field: QuickAiField; onChange: (v: string) => void }) {
  const base = 'w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none'
  return (
    <label className="block">
      <span className="block text-xs text-zinc-500 mb-1">{field.label}</span>
      {field.fieldType === 'select' && field.options && field.options.length > 0 ? (
        <select value={field.value} onChange={(e) => onChange(e.target.value)} className={base}>
          <option value="">—</option>
          {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : field.fieldType === 'textarea' ? (
        <textarea value={field.value} onChange={(e) => onChange(e.target.value)} rows={3} className={base} />
      ) : field.fieldType === 'boolean' ? (
        <select value={field.value} onChange={(e) => onChange(e.target.value)} className={base}>
          <option value="">—</option>
          <option value="true">はい</option>
          <option value="false">いいえ</option>
        </select>
      ) : (
        <input
          type={field.fieldType === 'number' ? 'number' : field.fieldType === 'date' ? 'date' : 'text'}
          value={field.value}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        />
      )}
    </label>
  )
}
