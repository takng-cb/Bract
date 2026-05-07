'use client'

/**
 * RecordSearchInput
 *
 * フォーム内で「レコードを名前検索して ID を選択する」入力コンポーネント。
 * hidden input に選択した UUID を保持するため、通常のフォーム送信と同じように機能する。
 *
 * 使用例: account_id / contact_id フィールド
 */

import { useState, useRef, useEffect } from 'react'

type SearchResult = { id: string; label: string; sub?: string }

type Props = {
  /** form field 名（hidden input の name 属性） */
  name: string
  /** /api/search/records の objectType パラメータ */
  objectType: 'accounts' | 'contacts'
  /** 編集時の初期 UUID */
  defaultId?: string
  /** 編集時の初期表示名（サーバー側で解決して渡す） */
  defaultLabel?: string
  placeholder?: string
  required?: boolean
}

export default function RecordSearchInput({
  name,
  objectType,
  defaultId = '',
  defaultLabel = '',
  placeholder = '名前で検索...',
  required = false,
}: Props) {
  const [selectedId,    setSelectedId]    = useState(defaultId)
  const [selectedLabel, setSelectedLabel] = useState(defaultLabel)
  const [query,         setQuery]         = useState('')
  const [results,       setResults]       = useState<SearchResult[]>([])
  const [open,          setOpen]          = useState(false)
  const [searching,     setSearching]     = useState(false)

  const wrapperRef  = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 外クリックでドロップダウンを閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
        // 選択済みなら検索欄を空に戻す（未確定のクエリを捨てる）
        if (selectedId) setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [selectedId])

  // 入力変化 → デバウンスして API 検索
  const handleQueryChange = (value: string) => {
    setQuery(value)
    // クエリを変更したら選択をリセット
    setSelectedId('')
    setSelectedLabel('')

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!value.trim()) {
      setResults([])
      setOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(
          `/api/search/records?objectType=${encodeURIComponent(objectType)}&q=${encodeURIComponent(value)}`
        )
        if (res.ok) {
          const data: SearchResult[] = await res.json()
          setResults(data)
          setOpen(data.length > 0)
        }
      } finally {
        setSearching(false)
      }
    }, 250)
  }

  // 候補を選択
  const handleSelect = (item: SearchResult) => {
    setSelectedId(item.id)
    setSelectedLabel(item.label)
    setQuery('')
    setOpen(false)
    setResults([])
  }

  // 選択を解除
  const handleClear = () => {
    setSelectedId('')
    setSelectedLabel('')
    setQuery('')
    setResults([])
    setOpen(false)
  }

  const base = 'w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

  return (
    <div ref={wrapperRef} className="relative">
      {/* フォーム送信用 hidden input */}
      <input type="hidden" name={name} value={selectedId} />

      {/* 選択済みの表示 */}
      {selectedId && selectedLabel ? (
        <div className="flex items-center gap-2 border border-blue-300 bg-blue-50 rounded-md px-3 py-2">
          <span className="flex-1 text-sm text-blue-900 font-medium truncate">
            {selectedLabel}
          </span>
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 text-blue-400 hover:text-blue-700 text-xs font-medium px-1 rounded"
            title="選択を解除"
          >
            ✕ 変更
          </button>
        </div>
      ) : (
        <>
          {/* 検索入力 */}
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onFocus={() => { if (results.length > 0) setOpen(true) }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setOpen(false); setQuery('') }
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (results.length > 0) handleSelect(results[0])
                }
              }}
              placeholder={placeholder}
              autoComplete="off"
              required={required && !selectedId}
              className={base}
            />
            {searching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs animate-spin">
                ⟳
              </span>
            )}
          </div>

          {/* ドロップダウン候補 */}
          {open && results.length > 0 && (
            <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-md shadow-lg max-h-52 overflow-y-auto">
              {results.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(item) }}
                    className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors"
                  >
                    <p className="text-sm font-medium text-zinc-800 truncate">{item.label}</p>
                    {item.sub && (
                      <p className="text-xs text-zinc-400 mt-0.5">{item.sub}</p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* ヒント */}
          <p className="mt-1 text-xs text-zinc-400">
            名前の一部を入力すると候補が表示されます
          </p>
        </>
      )}
    </div>
  )
}
