'use client'

/**
 * 関連レコードの複数選択 Picker（統一検索ボックス版 / REQ-0078）。
 * 活動・ToDo・経費フォームと詳細ページのインライン編集で使う共通 UI。
 *
 * 旧実装は「行を追加→ブック種別を選ぶ→検索」の多段だったが、AI 検索の体験に寄せ、
 * **1 つの検索ボックスで許可された種別を横断検索 → カードから選択 → チップ**に刷新。
 *   - 入力で 250ms デバウンス。許可種別ごとに /api/search/records を並列で叩いて統合
 *   - 結果はカード（ラベル＋種別バッジ）。クリックで選択/解除（＋ / ✓）
 *   - 選択済みはチップ表示（検索しても保持）。defaultValue は ids= でラベル一括解決
 *
 * 送信形式は従来どおり hidden input name={name} value="<object_api>:<record_id>"。
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Search, Plus, Check, Loader2 } from 'lucide-react'
import { NavIcon } from '@/lib/navIcon'

export type ObjectTypeOption = {
  api:   string
  label: string
  icon?: string
}

export type RecordOption = { id: string; label: string; sub?: string }

export type RelatedRecordSelection = {
  object_api: string
  record_id:  string
  label?: string
}

type Props = {
  name?:            string
  objectTypes:      ObjectTypeOption[]
  /** @deprecated 互換のため残置（未使用） */
  recordsByObject?: Record<string, RecordOption[]>
  defaultValue?:    RelatedRecordSelection[]
  defaultObjectApi?: string
}

type Candidate = { object_api: string; record_id: string; label: string; sub?: string; typeLabel: string; icon?: string }
type Selected = { object_api: string; record_id: string; label: string; typeLabel: string; icon?: string }

const keyOf = (api: string, id: string) => `${api}:${id}`

async function fetchRecords(objectApi: string, params: Record<string, string>): Promise<RecordOption[]> {
  const sp = new URLSearchParams({ objectType: objectApi, ...params })
  const res = await fetch(`/api/search/records?${sp.toString()}`)
  if (!res.ok) return []
  return res.json()
}

export default function RelatedRecordsPicker({
  name = 'related_records',
  objectTypes,
  defaultValue = [],
}: Props) {
  const [selected, setSelected] = useState<Map<string, Selected>>(() => {
    const m = new Map<string, Selected>()
    for (const d of defaultValue) {
      const t = objectTypes.find((o) => o.api === d.object_api)
      m.set(keyOf(d.object_api, d.record_id), {
        object_api: d.object_api, record_id: d.record_id,
        label: d.label ?? '…', typeLabel: t?.label ?? d.object_api, icon: t?.icon,
      })
    }
    return m
  })
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(false)
  const reqIdRef = useRef(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 既存選択（編集時）のラベルを ids= で一括解決（初回のみ）
  const labelResolvedRef = useRef(false)
  useEffect(() => {
    if (labelResolvedRef.current) return
    labelResolvedRef.current = true
    const byApi = new Map<string, string[]>()
    for (const s of selected.values()) {
      if (s.label === '…') byApi.set(s.object_api, [...(byApi.get(s.object_api) ?? []), s.record_id])
    }
    if (byApi.size === 0) return
    ;(async () => {
      for (const [api, ids] of byApi) {
        const recs = await fetchRecords(api, { ids: ids.join(','), limit: String(ids.length) })
        const labels = new Map(recs.map((r) => [r.id, r.label]))
        setSelected((prev) => {
          const next = new Map(prev)
          for (const id of ids) {
            const k = keyOf(api, id)
            const cur = next.get(k)
            if (cur && cur.label === '…') next.set(k, { ...cur, label: labels.get(id) ?? `#${id.slice(0, 8)}` })
          }
          return next
        })
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const search = useCallback((q: string) => {
    const trimmed = q.trim()
    if (!trimmed) { setResults([]); setLoading(false); return }
    const reqId = ++reqIdRef.current
    setLoading(true)
    Promise.all(
      objectTypes.map((t) =>
        fetchRecords(t.api, { q: trimmed, limit: '6' }).then((recs) =>
          recs.map((r) => ({ object_api: t.api, record_id: r.id, label: r.label, sub: r.sub, typeLabel: t.label, icon: t.icon })),
        ),
      ),
    ).then((lists) => {
      if (reqId !== reqIdRef.current) return // 古い応答は破棄
      setResults(lists.flat())
      setLoading(false)
    })
  }, [objectTypes])

  function onQuery(v: string) {
    setQuery(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(v), 250)
  }

  function toggle(c: Candidate) {
    setSelected((prev) => {
      const next = new Map(prev)
      const k = keyOf(c.object_api, c.record_id)
      if (next.has(k)) next.delete(k)
      else next.set(k, { object_api: c.object_api, record_id: c.record_id, label: c.label, typeLabel: c.typeLabel, icon: c.icon })
      return next
    })
  }

  function remove(k: string) {
    setSelected((prev) => { const next = new Map(prev); next.delete(k); return next })
  }

  const selectedArr = Array.from(selected.entries())

  return (
    <div className="space-y-2">
      {/* hidden inputs（サーバ送信用） */}
      {selectedArr.map(([k, s]) => (
        <input key={k} type="hidden" name={name} value={`${s.object_api}:${s.record_id}`} />
      ))}

      {/* 選択済みチップ */}
      {selectedArr.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedArr.map(([k, s]) => (
            <span key={k} className="inline-flex items-center gap-1 max-w-full rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs pl-1.5 pr-1 py-0.5">
              {s.icon && <NavIcon icon={s.icon} className="w-3 h-3 shrink-0" />}
              <span className="text-[10px] text-blue-500">{s.typeLabel}</span>
              <span className="truncate">{s.label}</span>
              <button type="button" onClick={() => remove(k)} aria-label="解除" className="shrink-0 rounded-full hover:bg-blue-100 p-0.5">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* 統一検索ボックス */}
      <div className="relative">
        <Search className="w-4 h-4 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden />
        <input
          type="text"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={`名前で検索（${objectTypes.map((t) => t.label).slice(0, 4).join('・')}${objectTypes.length > 4 ? '…' : ''}）`}
          className="w-full rounded-md border border-zinc-300 bg-white pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 transition-colors"
        />
        {loading && <Loader2 className="w-4 h-4 text-zinc-400 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2" aria-hidden />}
      </div>

      {/* 結果カード（横断） */}
      {query.trim() && (
        loading && results.length === 0 ? (
          <p className="text-xs text-zinc-400 px-1 py-1">検索中…</p>
        ) : results.length === 0 ? (
          <p className="text-xs text-zinc-400 px-1 py-1">該当するレコードがありません</p>
        ) : (
          <div className="border border-zinc-200 rounded-md divide-y divide-zinc-100 max-h-56 overflow-y-auto bg-white">
            {results.map((c) => {
              const checked = selected.has(keyOf(c.object_api, c.record_id))
              return (
                <button
                  key={keyOf(c.object_api, c.record_id)}
                  type="button"
                  onClick={() => toggle(c)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-50 transition-colors ${checked ? 'bg-blue-50/60' : ''}`}
                >
                  {c.icon && <NavIcon icon={c.icon} className="w-4 h-4 shrink-0 text-zinc-400" />}
                  <span className="text-sm text-zinc-800 truncate">{c.label}</span>
                  <span className="text-[10px] text-zinc-500 bg-zinc-100 rounded px-1.5 py-0.5 shrink-0">{c.typeLabel}</span>
                  {c.sub && <span className="text-xs text-zinc-400 truncate hidden sm:inline">{c.sub}</span>}
                  <span className="ml-auto shrink-0">
                    {checked
                      ? <Check className="w-4 h-4 text-blue-600" strokeWidth={2.5} aria-hidden />
                      : <Plus className="w-4 h-4 text-zinc-400" aria-hidden />}
                  </span>
                </button>
              )
            })}
          </div>
        )
      )}

      {selectedArr.length === 0 && !query.trim() && (
        <p className="text-xs text-zinc-400 px-1">名前で検索して関連先を追加できます。</p>
      )}
    </div>
  )
}
