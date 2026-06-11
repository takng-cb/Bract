'use client'

/**
 * 「検索→なければ新規」コンボボックス（REQ-0042）。
 * 整備の詳細ページ（顧客/車両セクション）と新規作成フォームで共用する。
 *
 * - 選択済みはチップ表示（✕で解除して再検索）
 * - 入力はデバウンス検索（useDebouncedSearch と組で使う）
 * - 候補に完全一致が無いときは createHint（新規作成の案内）を表示
 */
import { useEffect, useRef, useState, useTransition } from 'react'
import { Loader2, Plus, X } from 'lucide-react'

export function SearchCombo({
  placeholder, selectedLabel, onClear, value, onChange, candidates, searching, onPick, createHint,
}: {
  placeholder: string
  selectedLabel: string | null
  onClear: () => void
  value: string
  onChange: (v: string) => void
  candidates: { id: string; label: string }[]
  searching: boolean
  onPick: (id: string, label: string) => void
  /** 候補に完全一致が無いとき表示する新規作成ヒント */
  createHint?: string
}) {
  const [focused, setFocused] = useState(false)
  if (selectedLabel) {
    return (
      <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-sm text-brand-800">
        <span className="truncate">{selectedLabel}</span>
        <button type="button" onClick={onClear} aria-label="選択を解除" className="shrink-0 text-brand-400 hover:text-brand-700">
          <X className="w-3.5 h-3.5" />
        </button>
      </span>
    )
  }
  const showList = focused && value.trim().length > 0
  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-md border border-zinc-300 px-2.5 py-1.5 focus-within:border-brand-400">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={placeholder}
          className="w-full text-sm outline-none"
        />
        {searching && <Loader2 className="w-4 h-4 shrink-0 animate-spin text-zinc-300" aria-hidden />}
      </div>
      {showList && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-md border border-zinc-200 bg-white py-1 shadow-lg">
          {candidates.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onPick(c.id, c.label) }}
              className="block w-full truncate px-3 py-1.5 text-left text-sm text-zinc-800 hover:bg-zinc-50"
            >
              {c.label}
            </button>
          ))}
          {createHint && (
            <p className="flex items-center gap-1 px-3 py-1.5 text-xs text-emerald-700">
              <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden />{createHint}
            </p>
          )}
          {candidates.length === 0 && !createHint && (
            <p className="px-3 py-1.5 text-xs text-zinc-400">{searching ? '検索中…' : '候補がありません'}</p>
          )}
        </div>
      )}
    </div>
  )
}

export function useDebouncedSearch<T>(query: string, search: (q: string) => Promise<T[]>): { results: T[]; searching: boolean } {
  const [results, setResults] = useState<T[]>([])
  const [searching, startTransition] = useTransition()
  const reqId = useRef(0)
  useEffect(() => {
    const myId = ++reqId.current
    const q = query.trim()
    const t = setTimeout(() => {
      if (reqId.current !== myId) return
      if (q.length < 1) { setResults([]); return }
      startTransition(async () => {
        const res = await search(q)
        if (reqId.current === myId) setResults(res)
      })
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])
  return { results, searching }
}
