'use client'

import { useState, useRef, useEffect } from 'react'

export type SelectOption = {
  value: string
  label: string
}

type Props = {
  name:          string
  options:       SelectOption[]
  defaultValue?: string | null
  placeholder?:  string
  className?:    string
  onSelect?:     (value: string) => void
}

/**
 * 検索付きセレクトボックス。
 * hidden input で値を保持するため、通常の <select> と同じように form 送信できる。
 */
export default function SearchableSelect({
  name,
  options,
  defaultValue = '',
  placeholder = '選択してください',
  className = '',
  onSelect,
}: Props) {
  const initialValue = defaultValue ?? ''
  const [selected, setSelected] = useState<SelectOption | null>(
    () => options.find((o) => o.value === initialValue) ?? null
  )
  const [open, setOpen]     = useState(false)
  const [query, setQuery]   = useState('')
  const containerRef        = useRef<HTMLDivElement>(null)
  const searchRef           = useRef<HTMLInputElement>(null)

  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  // ── 外側クリックで閉じる
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  // ── ドロップダウンを開いたら検索欄にフォーカス
  useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])

  function handleSelect(opt: SelectOption | null) {
    setSelected(opt)
    setOpen(false)
    setQuery('')
    onSelect?.(opt?.value ?? '')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { setOpen(false); setQuery('') }
    if (e.key === 'Enter' && filtered.length > 0) {
      handleSelect(filtered[0])
      e.preventDefault()
    }
  }

  const base = 'w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div ref={containerRef} className="relative">
      {/* フォーム送信用 hidden input */}
      <input type="hidden" name={name} value={selected?.value ?? ''} />

      {/* トリガー（input 風ボタン） */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${className || base} bg-white text-left flex items-center justify-between gap-2 w-full`}
      >
        <span className={selected ? 'text-zinc-900 truncate' : 'text-zinc-400 truncate'}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`w-4 h-4 shrink-0 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {/* ドロップダウン */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-md shadow-lg">
          {/* 検索入力 */}
          <div className="p-2 border-b border-zinc-100">
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="検索..."
              className="w-full border border-zinc-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 選択肢リスト */}
          <ul className="max-h-52 overflow-y-auto py-1">
            {/* 空選択 */}
            <li
              onMouseDown={() => handleSelect(null)}
              className="px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-50 cursor-pointer"
            >
              {placeholder}
            </li>

            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-zinc-400 italic">見つかりません</li>
            ) : (
              filtered.map((o) => (
                <li
                  key={o.value}
                  onMouseDown={() => handleSelect(o)}
                  className={`px-3 py-2 text-sm cursor-pointer truncate ${
                    selected?.value === o.value
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-zinc-800 hover:bg-zinc-50'
                  }`}
                >
                  {o.label}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
