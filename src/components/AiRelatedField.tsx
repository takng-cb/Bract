'use client'

/**
 * AI作成の関連先フィールド（REQ-0085 / ADR-0030）。
 * 既存レコードを検索して紐付ける／該当が無ければ「新規作成（型＋名前）」を選べる。
 * 値は RelatedRef[]（existing | new）。new は確定時にサーバで作成される。
 * QuickLauncher（単一・複数案件）で共用。
 */
import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { type RelatedRef } from '@/lib/quickAiTypes'
import QuickCreateRelatedModal from '@/components/QuickCreateRelatedModal'

type Candidate = { object_api: string; record_id: string; label: string; kind: string }

export default function AiRelatedField({
  value, onChange, search, placeholder = '名前で検索して追加（取引先・商談など）…',
}: {
  value: RelatedRef[]
  onChange: (next: RelatedRef[]) => void
  search: (q: string) => Promise<Candidate[]>
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Candidate[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const q = query.trim()

  const run = async (v: string) => {
    setQuery(v)
    if (v.trim().length < 1) { setResults([]); return }
    try { setResults(await search(v)) } catch { setResults([]) }
  }
  const isSelected = (api: string, id: string) => value.some((x) => x.mode === 'existing' && x.object_api === api && x.record_id === id)
  const addExisting = (c: Candidate) => { onChange([...value, { mode: 'existing', ...c }]); setQuery(''); setResults([]) }
  const remove = (i: number) => onChange(value.filter((_, k) => k !== i))

  return (
    <div>
      {value.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {value.map((v, i) => (
            <span key={i} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${v.mode === 'new' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-blue-200 bg-blue-50 text-blue-800'}`}>
              <span className="text-[10px] opacity-70">{v.kind}</span>
              {v.mode === 'existing' ? v.label : <span>{v.name}<span className="ml-0.5 text-[10px] text-emerald-600">(新規)</span></span>}
              <button type="button" onClick={() => remove(i)} className="opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}

      <input
        value={query}
        onChange={(e) => run(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      />

      {results.filter((r) => !isSelected(r.object_api, r.record_id)).length > 0 && (
        <ul className="mt-1 max-h-44 overflow-y-auto rounded-md border border-zinc-200 bg-white">
          {results.filter((r) => !isSelected(r.object_api, r.record_id)).map((r) => (
            <li key={`${r.object_api}:${r.record_id}`}>
              <button type="button" onClick={() => addExisting(r)} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-zinc-50">
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500">{r.kind}</span>
                <span className="truncate text-zinc-800">{r.label}</span>
                <Plus className="ml-auto h-3.5 w-3.5 text-zinc-400" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {q.length >= 1 && (
        <div className="mt-1">
          <button type="button" onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1 rounded-md border border-dashed border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-700 hover:bg-emerald-100">
            <Plus className="h-3.5 w-3.5" aria-hidden />該当が無ければ「{q}」を新規作成…
          </button>
        </div>
      )}

      {modalOpen && (
        <QuickCreateRelatedModal
          onClose={() => setModalOpen(false)}
          initialName={q}
          onCreated={(ref) => {
            onChange([...value, { mode: 'existing', object_api: ref.object_api, record_id: ref.record_id, label: ref.label, kind: ref.kind }])
            setQuery(''); setResults([])
          }}
        />
      )}
    </div>
  )
}
