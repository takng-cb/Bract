'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { addRelationshipValue, removeRelationshipValue } from '@/app/actions/relationships'

// ────────────────────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────────────────────

type SearchResult = { id: string; label: string; sub?: string }

type RemoveProps = {
  mode: 'remove'
  relationshipId: string
  sourceRecordId: string
  targetRecordId: string
  pagePath: string
}

type AddProps = {
  mode: 'add'
  relationshipId: string
  relatedObjectType: string
  currentRecordId: string
  isSource: boolean
  pagePath: string
  existingIds: string[]
}

type Props = RemoveProps | AddProps

export default function RelatedRecordsEditor(props: Props) {
  if (props.mode === 'remove') return <RemoveButton {...props} />
  return <AddForm {...props} />
}

// ────────────────────────────────────────────────────────────
// 解除ボタン
// ────────────────────────────────────────────────────────────

function RemoveButton({ relationshipId, sourceRecordId, targetRecordId, pagePath }: RemoveProps) {
  const [pending, startTransition] = useTransition()

  const handleClick = () => {
    if (!confirm('この関係を解除しますか？')) return
    startTransition(async () => {
      await removeRelationshipValue(relationshipId, sourceRecordId, targetRecordId, pagePath)
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="shrink-0 text-xs px-2 py-1 text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
    >
      {pending ? '...' : '解除'}
    </button>
  )
}

// ────────────────────────────────────────────────────────────
// 追加フォーム（オートコンプリート付き）
// ────────────────────────────────────────────────────────────

function AddForm({
  relationshipId,
  relatedObjectType,
  currentRecordId,
  isSource,
  pagePath,
  existingIds,
}: AddProps) {
  const [query, setQuery]             = useState('')
  const [results, setResults]         = useState<SearchResult[]>([])
  const [open, setOpen]               = useState(false)
  const [selected, setSelected]       = useState<SearchResult | null>(null)
  const [pending, startTransition]    = useTransition()
  const [error, setError]             = useState<string | null>(null)
  const [searching, setSearching]     = useState(false)
  const wrapperRef                    = useRef<HTMLDivElement>(null)
  const debounceRef                   = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 外側クリックでドロップダウンを閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // 入力変化 → デバウンスして API 検索
  const handleQueryChange = (value: string) => {
    setQuery(value)
    setSelected(null)
    setError(null)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!value.trim()) {
      setResults([])
      setOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const excludeParam = existingIds.join(',')
        const res = await fetch(
          `/api/search/records?objectType=${encodeURIComponent(relatedObjectType)}&q=${encodeURIComponent(value)}&exclude=${encodeURIComponent(excludeParam)}`
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
    setSelected(item)
    setQuery(item.label)
    setOpen(false)
    setResults([])
  }

  // 追加実行
  const handleAdd = () => {
    if (!selected) return
    setError(null)
    startTransition(async () => {
      try {
        const sourceId = isSource ? currentRecordId : selected.id
        const targetId = isSource ? selected.id : currentRecordId
        await addRelationshipValue(relationshipId, sourceId, targetId, pagePath)
        setQuery('')
        setSelected(null)
      } catch {
        setError('追加に失敗しました')
      }
    })
  }

  // キーボード操作
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && selected) {
      e.preventDefault()
      handleAdd()
    }
    if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2" ref={wrapperRef}>
        {/* 検索インプット */}
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (results.length > 0) setOpen(true) }}
            placeholder="名前で検索..."
            autoComplete="off"
            className="w-full border border-zinc-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* 検索中スピナー */}
          {searching && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">
              ⟳
            </span>
          )}

          {/* ドロップダウン */}
          {open && results.length > 0 && (
            <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
              {results.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(item) }}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors"
                  >
                    <p className="text-xs font-medium text-zinc-800 truncate">{item.label}</p>
                    {item.sub && (
                      <p className="text-xs text-zinc-400">{item.sub}</p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 追加ボタン */}
        <button
          type="button"
          onClick={handleAdd}
          disabled={pending || !selected}
          className="shrink-0 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {pending ? '追加中...' : '追加'}
        </button>
      </div>

      {/* 選択中のレコード表示 */}
      {selected && (
        <p className="text-xs text-blue-600">
          ✓ 「{selected.label}」を選択中 — 追加ボタンで確定
        </p>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <p className="text-xs text-zinc-400">
        名前の一部を入力すると候補が表示されます
      </p>
    </div>
  )
}
